package com.example.catering.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.catering.data.model.ShopConfig
import com.example.catering.data.repository.ShopRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SettingsUiState(
    val isLoading: Boolean = false,
    val shopConfig: ShopConfig = ShopConfig(),
    val showEditDialog: Boolean = false,
    val showClearDataDialog: Boolean = false,
    val errorMessage: String? = null,
    val message: String? = null
)

class SettingsViewModel(application: Application) : AndroidViewModel(application) {

    private val shopRepository = ShopRepository(application)

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        loadShopConfig()
    }

    private fun loadShopConfig() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val config = shopRepository.getShopConfig()
                _uiState.update { it.copy(isLoading = false, shopConfig = config) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = e.message) }
            }
        }
    }

    fun showEditDialog() {
        _uiState.update { it.copy(showEditDialog = true) }
    }

    fun hideEditDialog() {
        _uiState.update { it.copy(showEditDialog = false) }
    }

    fun showClearDataDialog() {
        _uiState.update { it.copy(showClearDataDialog = true) }
    }

    fun hideClearDataDialog() {
        _uiState.update { it.copy(showClearDataDialog = false) }
    }

    fun saveShopConfig(shopName: String, businessHours: String) {
        viewModelScope.launch {
            val config = ShopConfig(
                shopName = shopName,
                businessHours = businessHours,
                isFirstLaunch = false
            )
            shopRepository.saveShopConfig(config)
            _uiState.update {
                it.copy(
                    showEditDialog = false,
                    shopConfig = config,
                    message = "保存成功"
                )
            }
        }
    }

    fun clearMessage() {
        _uiState.update { it.copy(message = null, errorMessage = null) }
    }
}