package com.example.catering.ui.screen

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.catering.data.model.Dish
import com.example.catering.ui.component.CommonTextField
import com.example.catering.ui.component.DishItemCard
import com.example.catering.viewmodel.HomeViewModel
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onOrderCreated: () -> Unit,
    viewModel: HomeViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val currencyFormat = NumberFormat.getCurrencyInstance(Locale.CHINA)

    LaunchedEffect(uiState.orderCreated) {
        if (uiState.orderCreated) {
            viewModel.clearOrderCreated()
            onOrderCreated()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("点餐") }
            )
        },
        floatingActionButton = {
            if (uiState.selectedItems.isNotEmpty()) {
                FloatingActionButton(
                    onClick = viewModel::showRemarkDialog
                ) {
                    Text("下单", color = MaterialTheme.colorScheme.onPrimary)
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            if (uiState.isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center)
                )
            } else {
                Column(modifier = Modifier.fillMaxSize()) {
                    LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(uiState.dishes.filter { it.inStock }) { dish ->
                            DishItemCard(
                                dish = dish,
                                selectedQuantity = viewModel.getSelectedQuantity(dish.id),
                                onClick = { viewModel.selectDish(dish) }
                            )
                        }
                    }

                    if (uiState.selectedItems.isNotEmpty()) {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp)
                            ) {
                                Text(
                                    text = "已选菜品",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(8.dp))

                                uiState.selectedItems.forEach { item ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 4.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "${item.dishName} x${item.quantity}",
                                            style = MaterialTheme.typography.bodyMedium
                                        )
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            IconButton(
                                                onClick = { viewModel.deselectDish(item.dishId) }
                                            ) {
                                                Icon(Icons.Default.Remove, contentDescription = "减少")
                                            }
                                            Text(
                                                text = "${item.quantity}",
                                                style = MaterialTheme.typography.bodyLarge
                                            )
                                            IconButton(
                                                onClick = {
                                                    val dish = uiState.dishes.find { it.id == item.dishId }
                                                    dish?.let { viewModel.selectDish(it) }
                                                }
                                            ) {
                                                Icon(Icons.Default.Add, contentDescription = "增加")
                                            }
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(8.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "合计",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = currencyFormat.format(uiState.totalAmount),
                                        style = MaterialTheme.typography.titleLarge,
                                        color = MaterialTheme.colorScheme.primary,
                                        fontWeight = FontWeight.Bold
                                    )
                                }

                                Spacer(modifier = Modifier.height(8.dp))

                                Button(
                                    onClick = viewModel::showRemarkDialog,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text("创建订单")
                                }
                            }
                        }
                    }
                }
            }
        }

        if (uiState.showRemarkDialog) {
            AlertDialog(
                onDismissRequest = viewModel::hideRemarkDialog,
                title = { Text("订单备注") },
                text = {
                    CommonTextField(
                        value = uiState.remark,
                        onValueChange = viewModel::updateRemark,
                        label = "备注（可选）"
                    )
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            viewModel.createOrder { }
                        }
                    ) {
                        Text("确认下单")
                    }
                },
                dismissButton = {
                    TextButton(onClick = viewModel::hideRemarkDialog) {
                        Text("取消")
                    }
                }
            )
        }
    }
}