# CONTRIBUTING.md - Jango Development Guide

## Branch rules
- **No direct pushes to main** — PRs only
- **develop** — integration branch (no auto-deploy; tag after local verification)
- Feature branches: `fix/{issue}-{description}` or `feat/{issue}-{description}`
- Open a PR → maintainer review → merge

## Ktlint code style

### 1. Chain method continuation
```kotlin
// ✅ Correct: break the line after the variable, then .method()
fun example(http: HttpSecurity): SecurityFilterChain =
    http
        .csrf { it.disable() }
        .sessionManagement {
            it.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
        }.authorizeHttpRequests { auth ->  // .method() right after }
            auth
                .requestMatchers("/api/**")
                .permitAll()
        }.build()  // .method() right after }

// ❌ Incorrect
fun example(http: HttpSecurity): SecurityFilterChain =
    http.csrf { it.disable() }  // .csrf right after http is not allowed
        .build()
```

**Rules:**
- After a variable/parameter, **break the line** before `.method()`
- After a closing brace `}`, chain `.method()` **immediately** (no line break)

### 2. Function expression body
```kotlin
// ✅ Use = for single expressions
fun handleException(e: Exception): ResponseEntity<Map<String, Any>> =
    ResponseEntity
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(mapOf("error" to e.message))

// ❌ Unnecessary use of return
fun handleException(e: Exception): ResponseEntity<Map<String, Any>> {
    return ResponseEntity
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(mapOf("error" to e.message))
}
```

### 3. Running Ktlint locally
```bash
# Check
./gradlew ktlintCheck

# Auto-format
./gradlew ktlintFormat
```

## Commit messages
```
fix: issue description (#issue-number)
feat: new feature (#issue-number)
refactor: refactoring
docs: documentation
test: tests
```

## PR rules
- Title: `fix: description` or `feat: description`
- Body: include `Closes #issue-number`
- CI must pass

## Testing
- Run local tests before a PR: `./gradlew test`
- New features should include tests

## Deployment
- Local verification → push a `v*` tag → auto-deploy to production (no sandbox)
- See `INFRASTRUCTURE.md` for local verification commands
