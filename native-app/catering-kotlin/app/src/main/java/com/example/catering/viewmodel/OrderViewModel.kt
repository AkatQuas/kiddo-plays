package com.example.catering.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.catering.data.model.Order
import com.example.catering.data.model.OrderStatus
import com.example.catering.data.repository.OrderRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class OrderListUiState(
    val isLoading: Boolean = false,
    val orders: List<Order> = emptyList(),
    val filterStatus: OrderStatus? = null,
    val selectedOrder: Order? = null,
    val showStatusDialog: Boolean = false,
    val showDeleteDialog: Boolean = false,
    val errorMessage: String? = null
)

class OrderViewModel(application: Application) : AndroidViewModel(application) {

    private val orderRepository = OrderRepository(application)

    private val _uiState = MutableStateFlow(OrderListUiState())
    val uiState: StateFlow<OrderListUiState> = _uiState.asStateFlow()

    init {
        loadOrders()
    }

    fun loadOrders() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val orders = orderRepository.getAllOrders()
                val filteredOrders = _uiState.value.filterStatus?.let { status ->
                    orders.filter { it.status == status }
                } ?: orders
                _uiState.update { it.copy(isLoading = false, orders = filteredOrders) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = e.message) }
            }
        }
    }

    fun setFilterStatus(status: OrderStatus?) {
        _uiState.update { it.copy(filterStatus = status) }
        loadOrders()
    }

    fun selectOrder(order: Order) {
        _uiState.update { it.copy(selectedOrder = order) }
    }

    fun clearSelectedOrder() {
        _uiState.update { it.copy(selectedOrder = null) }
    }

    fun showStatusDialog() {
        _uiState.update { it.copy(showStatusDialog = true) }
    }

    fun hideStatusDialog() {
        _uiState.update { it.copy(showStatusDialog = false) }
    }

    fun showDeleteDialog() {
        _uiState.update { it.copy(showDeleteDialog = true) }
    }

    fun hideDeleteDialog() {
        _uiState.update { it.copy(showDeleteDialog = false) }
    }

    fun updateOrderStatus(status: OrderStatus, onStatusChanged: (String) -> Unit) {
        viewModelScope.launch {
            val order = _uiState.value.selectedOrder ?: return@launch
            orderRepository.updateOrderStatus(order.id, status)
            _uiState.update { it.copy(showStatusDialog = false, selectedOrder = null) }
            loadOrders()
            if (status == OrderStatus.COMPLETED) {
                onStatusChanged("订单已完成")
            }
        }
    }

    fun deleteOrder() {
        viewModelScope.launch {
            val order = _uiState.value.selectedOrder ?: return@launch
            orderRepository.deleteOrder(order.id)
            _uiState.update { it.copy(showDeleteDialog = false, selectedOrder = null) }
            loadOrders()
        }
    }
}