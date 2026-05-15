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

data class InitUiState(
    val shopName: String = "我的小店",
    val businessHours: String = "09:00-22:00",
    val isLoading: Boolean = false,
    val isComplete: Boolean = false,
    val errorMessage: String? = null
)

class InitViewModel(application: Application) : AndroidViewModel(application) {

    private val shopRepository = ShopRepository(application)

    private val _uiState = MutableStateFlow(InitUiState())
    val uiState: StateFlow<InitUiState> = _uiState.asStateFlow()

    init {
        checkFirstLaunch()
    }

    private fun checkFirstLaunch() {
        viewModelScope.launch {
            val isFirst = shopRepository.isFirstLaunch()
            if (!isFirst) {
                _uiState.update { it.copy(isComplete = true) }
            }
        }
    }

    fun updateShopName(name: String) {
        _uiState.update { it.copy(shopName = name) }
    }

    fun updateBusinessHours(hours: String) {
        _uiState.update { it.copy(businessHours = hours) }
    }

    fun completeSetup() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val config = ShopConfig(
                    shopName = _uiState.value.shopName,
                    businessHours = _uiState.value.businessHours,
                    isFirstLaunch = false
                )
                shopRepository.saveShopConfig(config)
                shopRepository.setFirstLaunchComplete()
                _uiState.update { it.copy(isLoading = false, isComplete = true) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = e.message) }
            }
        }
    }
}