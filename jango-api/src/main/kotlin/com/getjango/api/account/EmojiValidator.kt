package com.getjango.api.account

import java.text.BreakIterator
import java.util.Locale

object EmojiValidator {
    private const val MAX_EMOJI_CODE_POINTS = 16

    fun isSingleEmojiSequence(value: String): Boolean {
        if (value.isBlank()) return false
        if (graphemeClusterCount(value) != 1) return false

        val codePoints = value.codePoints().toArray()
        if (codePoints.isEmpty() || codePoints.size > MAX_EMOJI_CODE_POINTS) return false

        var hasEmojiBase = false
        for (cp in codePoints) {
            when {
                isEmojiBase(cp) -> hasEmojiBase = true
                isAllowedEmojiConnector(cp) -> {
                    // allowed for composing emoji sequence
                }
                else -> return false
            }
        }

        return hasEmojiBase
    }

    private fun graphemeClusterCount(value: String): Int {
        val iterator = BreakIterator.getCharacterInstance(Locale.ROOT)
        iterator.setText(value)
        var count = 0
        var start = iterator.first()
        while (true) {
            val end = iterator.next()
            if (end == BreakIterator.DONE) break
            if (end > start) count++
            start = end
        }
        return count
    }

    private fun isEmojiBase(codePoint: Int): Boolean =
        codePoint in 0x1F300..0x1FAFF ||
            codePoint in 0x2600..0x26FF ||
            codePoint in 0x2700..0x27BF ||
            codePoint in 0x1F1E6..0x1F1FF ||
            codePoint == '#'.code ||
            codePoint == '*'.code ||
            codePoint in '0'.code..'9'.code

    private fun isAllowedEmojiConnector(codePoint: Int): Boolean =
        when (codePoint) {
            0x200D -> true // ZWJ
            0xFE0F -> true // emoji variation selector
            0xFE0E -> true // text variation selector
            0x20E3 -> true // keycap combining
            else -> codePoint in 0x1F3FB..0x1F3FF // skin tone modifiers
        }
}
