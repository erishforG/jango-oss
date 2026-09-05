package com.getjango.api.admin.rule

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

@Service
class CardSmsApiKeyCryptoService(
    @Value("\${jango.card-sms.ai.config-encryption-key:}")
    private val encryptionKey: String,
) {
    private val secureRandom = SecureRandom()

    fun encrypt(plainText: String): String {
        val keyBytes = normalizedKey()
        val iv = ByteArray(12).also { secureRandom.nextBytes(it) }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(keyBytes, "AES"), GCMParameterSpec(128, iv))
        val encrypted = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
        val merged = ByteArray(iv.size + encrypted.size)
        System.arraycopy(iv, 0, merged, 0, iv.size)
        System.arraycopy(encrypted, 0, merged, iv.size, encrypted.size)
        return Base64.getEncoder().encodeToString(merged)
    }

    fun decrypt(cipherText: String): String {
        val keyBytes = normalizedKey()
        val decoded = Base64.getDecoder().decode(cipherText)
        val iv = decoded.copyOfRange(0, 12)
        val encrypted = decoded.copyOfRange(12, decoded.size)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(keyBytes, "AES"), GCMParameterSpec(128, iv))
        return String(cipher.doFinal(encrypted), Charsets.UTF_8)
    }

    private fun normalizedKey(): ByteArray {
        val raw = encryptionKey.trim()
        require(raw.isNotBlank()) { "jango.card-sms.ai.config-encryption-key is required" }

        val bytes =
            try {
                Base64.getDecoder().decode(raw)
            } catch (_: IllegalArgumentException) {
                raw.toByteArray(Charsets.UTF_8)
            }

        require(bytes.size == 32) { "config-encryption-key must be 32 bytes (raw or base64)" }
        return bytes
    }
}
