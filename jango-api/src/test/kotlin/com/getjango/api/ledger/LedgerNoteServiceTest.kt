package com.getjango.api.ledger

import com.getjango.api.auth.AuthContext
import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerMembership
import com.getjango.core.ledger.LedgerMembershipRepository
import com.getjango.core.ledger.LedgerMembershipRole
import com.getjango.core.ledger.LedgerMembershipStatus
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.HttpStatus
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class LedgerNoteServiceTest {
    @Autowired
    lateinit var ledgerNoteService: LedgerNoteService

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var ledgerRepository: LedgerRepository

    @Autowired
    lateinit var ledgerMembershipRepository: LedgerMembershipRepository

    @AfterEach
    fun tearDown() {
        AuthContext.clear()
    }

    @Test
    fun `listNotes puts pinned unresolved notes first and hides resolved by default`() {
        val owner = createUser("notes-owner")
        val ledger = createLedger(owner)
        addMembership(ledger, owner, LedgerMembershipRole.OWNER)
        AuthContext.setCurrentUser(owner)

        val normal = ledgerNoteService.createNote(ledger.id, CreateLedgerNoteRequest("이번 달 외식비 확인"))
        val pinned = ledgerNoteService.createNote(ledger.id, CreateLedgerNoteRequest("월급일 로카365 결제분 남기기"))
        val resolved = ledgerNoteService.createNote(ledger.id, CreateLedgerNoteRequest("처리된 메모"))
        ledgerNoteService.patchNote(ledger.id, pinned.noteId, PatchLedgerNoteRequest(pinned = true))
        ledgerNoteService.patchNote(ledger.id, resolved.noteId, PatchLedgerNoteRequest(resolved = true))

        val activeNotes = ledgerNoteService.listNotes(ledger.id, includeResolved = false)
        assertEquals(listOf(pinned.noteId, normal.noteId), activeNotes.map { it.noteId })

        val allNotes = ledgerNoteService.listNotes(ledger.id, includeResolved = true)
        assertEquals(listOf(pinned.noteId, normal.noteId, resolved.noteId), allNotes.map { it.noteId })
    }

    @Test
    fun `viewer can read but cannot create notes`() {
        val owner = createUser("notes-owner")
        val viewer = createUser("notes-viewer")
        val ledger = createLedger(owner)
        addMembership(ledger, owner, LedgerMembershipRole.OWNER)
        addMembership(ledger, viewer, LedgerMembershipRole.VIEWER)

        AuthContext.setCurrentUser(owner)
        ledgerNoteService.createNote(ledger.id, CreateLedgerNoteRequest("읽을 수 있는 메모"))

        AuthContext.setCurrentUser(viewer)
        assertEquals(1, ledgerNoteService.listNotes(ledger.id, includeResolved = false).size)

        val ex =
            assertThrows(ResponseStatusException::class.java) {
                ledgerNoteService.createNote(ledger.id, CreateLedgerNoteRequest("작성 불가"))
            }
        assertEquals(HttpStatus.FORBIDDEN, ex.statusCode)
    }

    @Test
    fun `editor cannot pin notes`() {
        val owner = createUser("notes-owner")
        val editor = createUser("notes-editor")
        val ledger = createLedger(owner)
        addMembership(ledger, owner, LedgerMembershipRole.OWNER)
        addMembership(ledger, editor, LedgerMembershipRole.EDITOR)

        AuthContext.setCurrentUser(editor)
        val note = ledgerNoteService.createNote(ledger.id, CreateLedgerNoteRequest("고정 시도"))
        val ex =
            assertThrows(ResponseStatusException::class.java) {
                ledgerNoteService.patchNote(ledger.id, note.noteId, PatchLedgerNoteRequest(pinned = true))
            }
        assertEquals(HttpStatus.FORBIDDEN, ex.statusCode)
        assertFalse(ledgerNoteService.listNotes(ledger.id, includeResolved = true).first().pinned)
    }

    private fun createUser(prefix: String): User = userRepository.save(User(email = "$prefix-${System.nanoTime()}@jango.local"))

    private fun createLedger(owner: User): Ledger = ledgerRepository.save(Ledger(user = owner, name = "notes-ledger-${System.nanoTime()}"))

    private fun addMembership(
        ledger: Ledger,
        user: User,
        role: LedgerMembershipRole,
    ) {
        ledgerMembershipRepository.save(
            LedgerMembership(
                ledger = ledger,
                user = user,
                role = role,
                status = LedgerMembershipStatus.ACTIVE,
            ),
        )
    }
}
