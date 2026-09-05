package com.getjango.api.account

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class EmojiValidatorTest {
    @Test
    fun `accepts single emoji`() {
        assertTrue(EmojiValidator.isSingleEmojiSequence("😀"))
    }

    @Test
    fun `accepts single emoji sequence`() {
        assertTrue(EmojiValidator.isSingleEmojiSequence("👨‍👩‍👧‍👦"))
    }

    @Test
    fun `rejects non emoji text`() {
        assertFalse(EmojiValidator.isSingleEmojiSequence("hello"))
    }

    @Test
    fun `rejects multiple emojis`() {
        assertFalse(EmojiValidator.isSingleEmojiSequence("😀😀"))
    }

    @Test
    fun `rejects overly long emoji sequence`() {
        val tooLong = "👨‍👩‍👧‍👦👨‍👩‍👧‍👦"
        assertFalse(EmojiValidator.isSingleEmojiSequence(tooLong))
    }
}
