package com.example.catering.ui.screen

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.catering.ui.component.CommonTextField
import com.example.catering.ui.component.ConfirmDialog
import com.example.catering.viewmodel.SettingsViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    var editShopName by remember { mutableStateOf(uiState.shopConfig.shopName) }
    var editBusinessHours by remember { mutableStateOf(uiState.shopConfig.businessHours) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("设置") }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Text(
                text = "店铺信息",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(8.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    SettingsRow(label = "店铺名称", value = uiState.shopConfig.shopName)
                    Spacer(modifier = Modifier.height(8.dp))
                    SettingsRow(label = "营业时间", value = uiState.shopConfig.businessHours)
                    Spacer(modifier = Modifier.height(16.dp))
                    TextButton(onClick = {
                        editShopName = uiState.shopConfig.shopName
                        editBusinessHours = uiState.shopConfig.businessHours
                        viewModel.showEditDialog()
                    }) {
                        Text("编辑店铺信息")
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "数据管理",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(8.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Text(
                        text = "所有数据均保存在本地设备中",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "版本: 1.0.0",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        if (uiState.showEditDialog) {
            AlertDialog(
                onDismissRequest = viewModel::hideEditDialog,
                title = { Text("编辑店铺信息") },
                text = {
                    Column {
                        CommonTextField(
                            value = editShopName,
                            onValueChange = { editShopName = it },
                            label = "店铺名称"
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        CommonTextField(
                            value = editBusinessHours,
                            onValueChange = { editBusinessHours = it },
                            label = "营业时间"
                        )
                    }
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            viewModel.saveShopConfig(editShopName, editBusinessHours)
                        }
                    ) {
                        Text("保存")
                    }
                },
                dismissButton = {
                    TextButton(onClick = viewModel::hideEditDialog) {
                        Text("取消")
                    }
                }
            )
        }

        if (uiState.showClearDataDialog) {
            ConfirmDialog(
                title = "清除数据",
                message = "确定要清除所有数据吗？此操作不可恢复。",
                confirmText = "清除",
                onConfirm = { },
                onDismiss = viewModel::hideClearDataDialog
            )
        }
    }
}

@Composable
private fun SettingsRow(label: String, value: String) {
    Column {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyLarge
        )
    }
}