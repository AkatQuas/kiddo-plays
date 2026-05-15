package com.example.catering.ui.screen

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.catering.data.model.OrderStatus
import com.example.catering.ui.component.ConfirmDialog
import com.example.catering.ui.component.OrderItemCard
import com.example.catering.viewmodel.OrderViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderListScreen(
    viewModel: OrderViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("订单列表") }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = uiState.filterStatus == null,
                    onClick = { viewModel.setFilterStatus(null) },
                    label = { Text("全部") }
                )
                FilterChip(
                    selected = uiState.filterStatus == OrderStatus.UNPAID,
                    onClick = { viewModel.setFilterStatus(OrderStatus.UNPAID) },
                    label = { Text("未支付") }
                )
                FilterChip(
                    selected = uiState.filterStatus == OrderStatus.PAID,
                    onClick = { viewModel.setFilterStatus(OrderStatus.PAID) },
                    label = { Text("已支付") }
                )
                FilterChip(
                    selected = uiState.filterStatus == OrderStatus.COMPLETED,
                    onClick = { viewModel.setFilterStatus(OrderStatus.COMPLETED) },
                    label = { Text("已完成") }
                )
            }

            Box(modifier = Modifier.fillMaxSize()) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center)
                    )
                } else if (uiState.orders.isEmpty()) {
                    Text(
                        text = "暂无订单",
                        modifier = Modifier.align(Alignment.Center),
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(uiState.orders) { order ->
                            OrderItemCard(
                                order = order,
                                onClick = { viewModel.selectOrder(order) }
                            )
                        }
                    }
                }
            }
        }

        uiState.selectedOrder?.let { order ->
            val statusText = when (order.status) {
                OrderStatus.UNPAID -> "未支付"
                OrderStatus.PAID -> "已支付"
                OrderStatus.COMPLETED -> "已完成"
            }

            ConfirmDialog(
                title = "订单详情",
                message = buildString {
                    appendLine("订单号: ${order.id.take(8)}")
                    appendLine("状态: $statusText")
                    appendLine("菜品: ${order.items.joinToString(", ") { "${it.dishName}x${it.quantity}" }}")
                    appendLine("金额: ${order.amount}元")
                    if (order.remark.isNotEmpty()) {
                        appendLine("备注: ${order.remark}")
                    }
                },
                confirmText = "修改状态",
                dismissText = "关闭",
                onConfirm = { viewModel.showStatusDialog() },
                onDismiss = { viewModel.clearSelectedOrder() }
            )
        }

        if (uiState.showStatusDialog) {
            val order = uiState.selectedOrder
            if (order != null) {
                ConfirmDialog(
                    title = "修改订单状态",
                    message = "请选择新的订单状态",
                    confirmText = "已完成",
                    dismissText = "取消",
                    onConfirm = {
                        viewModel.updateOrderStatus(OrderStatus.COMPLETED) {}
                    },
                    onDismiss = { viewModel.hideStatusDialog() }
                )
            }
        }

        if (uiState.showDeleteDialog) {
            ConfirmDialog(
                title = "删除订单",
                message = "确定要删除这个订单吗？此操作不可恢复。",
                confirmText = "删除",
                onConfirm = viewModel::deleteOrder,
                onDismiss = viewModel::hideDeleteDialog
            )
        }
    }
}