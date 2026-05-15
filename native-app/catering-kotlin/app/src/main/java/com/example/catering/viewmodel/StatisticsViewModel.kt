package com.example.catering.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.catering.data.model.Order
import com.example.catering.data.model.OrderStatus
import com.example.catering.data.repository.OrderRepository
import com.example.catering.utils.TimeUtil
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class StatisticsUiState(
    val isLoading: Boolean = false,
    val todayOrderCount: Int = 0,
    val todayRevenue: Float = 0f,
    val averageOrderValue: Float = 0f,
    val unpaidCount: Int = 0,
    val paidCount: Int = 0,
    val completedCount: Int = 0,
    val errorMessage: String? = null
)

class StatisticsViewModel(application: Application) : AndroidViewModel(application) {

    private val orderRepository = OrderRepository(application)

    private val _uiState = MutableStateFlow(StatisticsUiState())
    val uiState: StateFlow<StatisticsUiState> = _uiState.asStateFlow()

    init {
        loadStatistics()
    }

    fun loadStatistics() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val allOrders = orderRepository.getAllOrders()
                val todayStart = TimeUtil.getTodayStartMillis()
                val todayOrders = allOrders.filter { it.createTime >= todayStart }

                val paidOrders = todayOrders.filter {
                    it.status == OrderStatus.PAID || it.status == OrderStatus.COMPLETED
                }
                val todayRevenue = paidOrders.sumOf { it.amount.toDouble() }.toFloat()
                val averageOrderValue = if (paidOrders.isNotEmpty()) {
                    todayRevenue / paidOrders.size
                } else {
                    0f
                }

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        todayOrderCount = todayOrders.size,
                        todayRevenue = todayRevenue,
                        averageOrderValue = averageOrderValue,
                        unpaidCount = todayOrders.count { o -> o.status == OrderStatus.UNPAID },
                        paidCount = todayOrders.count { o -> o.status == OrderStatus.PAID },
                        completedCount = todayOrders.count { o -> o.status == OrderStatus.COMPLETED }
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = e.message) }
            }
        }
    }
}