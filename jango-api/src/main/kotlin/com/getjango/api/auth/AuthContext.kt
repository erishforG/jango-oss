package com.getjango.api.auth

import com.getjango.core.user.User

object AuthContext {
    private val currentUserHolder = ThreadLocal<User?>()

    fun setCurrentUser(user: User?) {
        currentUserHolder.set(user)
    }

    fun currentUser(): User? = currentUserHolder.get()

    fun requireCurrentUser(): User = currentUser() ?: throw IllegalStateException("Not authenticated")

    fun clear() {
        currentUserHolder.remove()
    }
}
