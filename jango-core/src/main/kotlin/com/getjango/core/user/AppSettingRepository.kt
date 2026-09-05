package com.getjango.core.user

import org.springframework.data.jpa.repository.JpaRepository

interface AppSettingRepository : JpaRepository<AppSetting, String>
