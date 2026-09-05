package com.getjango.api.auth

import com.getjango.api.beta.ClosedBetaGuardException
import com.getjango.api.beta.ClosedBetaService
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val googleTokenVerifier: GoogleTokenVerifier,
    private val closedBetaService: ClosedBetaService,
) {
    @Transactional
    fun authenticateWithGoogle(idToken: String): User? {
        val googleUser = googleTokenVerifier.verify(idToken, allowGoogleApiFallback = true) ?: return null

        val user =
            userRepository.findByGoogleId(googleUser.sub).orElseGet {
                val existing = userRepository.findByEmail(googleUser.email)
                if (existing.isPresent) {
                    val u = existing.get()
                    u.googleId = googleUser.sub
                    u.displayName = googleUser.name ?: u.displayName
                    userRepository.save(u)
                } else {
                    userRepository.save(
                        User(
                            email = googleUser.email,
                            displayName = googleUser.name,
                            googleId = googleUser.sub,
                        ),
                    )
                }
            }

        if (!closedBetaService.isAllowedUser(user)) {
            throw ClosedBetaGuardException()
        }

        return user
    }
}
