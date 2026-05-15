package com.example.catering.data.repository

import android.content.Context
import android.content.SharedPreferences
import com.example.catering.data.model.ShopConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class ShopRepository(context: Context) {

    private val json = Json { ignoreUnknownKeys = true }
    private val prefs: SharedPreferences = context.getSharedPreferences("sp_shop_config", Context.MODE_PRIVATE)

    suspend fun getShopConfig(): ShopConfig = withContext(Dispatchers.IO) {
        val jsonStr = prefs.getString("config", null)
        if (jsonStr != null) {
            try {
                json.decodeFromString<ShopConfig>(jsonStr)
            } catch (e: Exception) {
                ShopConfig()
            }
        } else {
            ShopConfig()
        }
    }

    suspend fun saveShopConfig(config: ShopConfig) = withContext(Dispatchers.IO) {
        prefs.edit().putString("config", json.encodeToString(config)).apply()
    }

    suspend fun isFirstLaunch(): Boolean = withContext(Dispatchers.IO) {
        getShopConfig().isFirstLaunch
    }

    suspend fun setFirstLaunchComplete() = withContext(Dispatchers.IO) {
        val config = getShopConfig()
        saveShopConfig(config.copy(isFirstLaunch = false))
    }
}