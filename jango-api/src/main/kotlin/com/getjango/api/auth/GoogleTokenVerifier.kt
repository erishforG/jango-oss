package com.getjango.api.auth

import com.auth0.jwk.JwkProviderBuilder
import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.auth0.jwt.interfaces.DecodedJWT
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.net.URI
import java.net.URL
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.security.interfaces.RSAPublicKey
import java.time.Duration
import java.util.concurrent.TimeUnit

data class GoogleUserInfo(
    val sub: String,
    val email: String,
    val name: String?,
    val emailVerified: Boolean,
)

@Component
class GoogleTokenVerifier(
    @Value("\${google.client-id:placeholder-client-id}")
    private val clientId: String,
    @Value("\${firebase.project-id:placeholder-firebase-project-id}")
    private val firebaseProjectId: String,
    @Value("\${google.tokeninfo-timeout-ms:2500}")
    private val tokenInfoTimeoutMs: Long,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    private val jwkProvider =
        JwkProviderBuilder(
            URL("https://www.googleapis.com/robot/v1/metadata/jwk/securetoken@system.gserviceaccount.com"),
        ).cached(10, 24, TimeUnit.HOURS).rateLimited(50, 1, TimeUnit.MINUTES).build()

    fun verify(
        idToken: String,
        allowGoogleApiFallback: Boolean = true,
    ): GoogleUserInfo? {
        // Try Firebase ID Token verification first (JWT-based, no Admin SDK)
        val firebaseResult = verifyFirebaseToken(idToken)
        if (firebaseResult != null) return firebaseResult

        if (!allowGoogleApiFallback) {
            return null
        }

        // Fallback to Google tokeninfo API (for backward compatibility with GIS tokens)
        return verifyWithGoogleApi(idToken)
    }

    private fun verifyFirebaseToken(idToken: String): GoogleUserInfo? {
        return try {
            val decoded: DecodedJWT = JWT.decode(idToken)

            // Verify issuer matches Firebase project
            val expectedIssuer = "https://securetoken.google.com/$firebaseProjectId"
            if (decoded.issuer != expectedIssuer) return null

            // Verify with RSA public key
            val jwk = jwkProvider.get(decoded.keyId)
            val algorithm = Algorithm.RSA256(jwk.publicKey as RSAPublicKey, null)
            val verifier =
                JWT
                    .require(algorithm)
                    .withIssuer(expectedIssuer)
                    .withAudience(firebaseProjectId)
                    .build()
            val verified = verifier.verify(idToken)

            val email = verified.getClaim("email").asString() ?: return null
            val emailVerified = verified.getClaim("email_verified").asBoolean() ?: false
            if (!emailVerified) return null

            // Firebase sign_in_provider and Google sub
            val firebaseMap = verified.getClaim("firebase").asMap()
            val identities = firebaseMap?.get("identities") as? Map<*, *>
            val googleIds = identities?.get("google.com") as? List<*>
            val googleSub = googleIds?.firstOrNull()?.toString() ?: verified.subject

            GoogleUserInfo(
                sub = googleSub,
                email = email,
                name = verified.getClaim("name").asString(),
                emailVerified = true,
            )
        } catch (e: Exception) {
            log.debug("Firebase token verification failed: ${e.message}")
            null
        }
    }

    private fun verifyWithGoogleApi(idToken: String): GoogleUserInfo? {
        return try {
            val timeout = Duration.ofMillis(tokenInfoTimeoutMs.coerceIn(500, 10_000))
            val httpClient = HttpClient.newBuilder().connectTimeout(timeout).build()
            val mapper = jacksonObjectMapper()

            val request =
                HttpRequest
                    .newBuilder()
                    .uri(URI.create("https://oauth2.googleapis.com/tokeninfo?id_token=$idToken"))
                    .timeout(timeout)
                    .GET()
                    .build()
            val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() != 200) return null

            val body: Map<String, Any?> = mapper.readValue(response.body())
            val aud = body["aud"] as? String ?: return null
            if (aud != clientId) return null

            val emailVerified = (body["email_verified"] as? String) == "true"
            if (!emailVerified) return null

            GoogleUserInfo(
                sub = body["sub"] as? String ?: return null,
                email = body["email"] as? String ?: return null,
                name = body["name"] as? String,
                emailVerified = true,
            )
        } catch (_: Exception) {
            null
        }
    }
}
