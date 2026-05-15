import 'package:flutter/material.dart';
import 'models/models.dart';
import 'services/api_client.dart';

void main() {
  runApp(const OpsToolApp());
}

class OpsToolApp extends StatelessWidget {
  const OpsToolApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '运维管理工具',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _selectedIndex = 0;
  final ApiClient _apiClient = ApiClient();

  final List<Widget> _pages = [
    const StoresPage(),
    const VersionsPage(),
    const IssuesPage(),
    const ArtifactsPage(),
  ];

  @override
  void dispose() {
    _apiClient.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: _selectedIndex,
            onDestinationSelected: (index) => setState(() => _selectedIndex = index),
            labelType: NavigationRailLabelType.all,
            destinations: const [
              NavigationRailDestination(
                icon: Icon(Icons.store_outlined),
                selectedIcon: Icon(Icons.store),
                label: Text('门店'),
              ),
              NavigationRailDestination(
                icon: Icon(Icons.new_releases_outlined),
                selectedIcon: Icon(Icons.new_releases),
                label: Text('版本'),
              ),
              NavigationRailDestination(
                icon: Icon(Icons.bug_report_outlined),
                selectedIcon: Icon(Icons.bug_report),
                label: Text('故障'),
              ),
              NavigationRailDestination(
                icon: Icon(Icons.inventory_2_outlined),
                selectedIcon: Icon(Icons.inventory_2),
                label: Text('产物'),
              ),
            ],
          ),
          const VerticalDivider(thickness: 1, width: 1),
          Expanded(
            child: _pages[_selectedIndex],
          ),
        ],
      ),
    );
  }
}

// 门店管理页面
class StoresPage extends StatefulWidget {
  const StoresPage({super.key});

  @override
  State<StoresPage> createState() => _StoresPageState();
}

class _StoresPageState extends State<StoresPage> {
  final ApiClient _apiClient = ApiClient();
  List<Store> _stores = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadStores();
  }

  Future<void> _loadStores() async {
    setState(() => _isLoading = true);
    final stores = await _apiClient.getStores();
    setState(() {
      _stores = stores;
      _isLoading = false;
    });
  }

  Future<void> _createStore() async {
    final result = await showDialog<Store>(
      context: context,
      builder: (context) => const StoreDialog(),
    );
    if (result != null) {
      await _apiClient.createStore(result);
      _loadStores();
    }
  }

  Future<void> _updateStore(Store store) async {
    final result = await showDialog<Store>(
      context: context,
      builder: (context) => StoreDialog(store: store),
    );
    if (result != null) {
      await _apiClient.updateStore(store.id, result);
      _loadStores();
    }
  }

  Future<void> _deleteStore(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('确认删除'),
        content: const Text('确定要删除这个门店吗？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('删除'),
          ),
        ],
      ),
    );
    if (confirm == true) {
      await _apiClient.deleteStore(id);
      _loadStores();
    }
  }

  @override
  void dispose() {
    _apiClient.dispose();
    super.dispose();
  }

  String _getCoopStatusLabel(String status) {
    switch (status) {
      case 'cooperating':
        return '合作中';
      case 'finished':
        return '已结束';
      default:
        return '无合作';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('门店台账管理'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadStores,
          ),
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: _createStore,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _stores.isEmpty
              ? const Center(child: Text('暂无门店数据'))
              : ListView.builder(
                  itemCount: _stores.length,
                  itemBuilder: (context, index) {
                    final store = _stores[index];
                    return ListTile(
                      title: Text(store.name),
                      subtitle: Text('${store.owner} | ${store.address} | ${store.phone}'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Chip(label: Text(_getCoopStatusLabel(store.coopStatus))),
                          IconButton(
                            icon: const Icon(Icons.edit),
                            onPressed: () => _updateStore(store),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete),
                            onPressed: () => _deleteStore(store.id),
                          ),
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}

class StoreDialog extends StatefulWidget {
  final Store? store;

  const StoreDialog({super.key, this.store});

  @override
  State<StoreDialog> createState() => _StoreDialogState();
}

class _StoreDialogState extends State<StoreDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _ownerController;
  late final TextEditingController _addressController;
  late final TextEditingController _phoneController;
  late final TextEditingController _coopExpireAtController;
  String _coopStatus = 'none';

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.store?.name);
    _ownerController = TextEditingController(text: widget.store?.owner);
    _addressController = TextEditingController(text: widget.store?.address);
    _phoneController = TextEditingController(text: widget.store?.phone);
    _coopExpireAtController = TextEditingController(text: widget.store?.coopExpireAt);
    _coopStatus = widget.store?.coopStatus ?? 'none';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _ownerController.dispose();
    _addressController.dispose();
    _phoneController.dispose();
    _coopExpireAtController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.store == null ? '新增门店' : '编辑门店'),
      content: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: '名称'),
                validator: (value) => value?.isEmpty == true ? '必填' : null,
              ),
              TextFormField(
                controller: _ownerController,
                decoration: const InputDecoration(labelText: '负责人'),
                validator: (value) => value?.isEmpty == true ? '必填' : null,
              ),
              TextFormField(
                controller: _addressController,
                decoration: const InputDecoration(labelText: '地址'),
                validator: (value) => value?.isEmpty == true ? '必填' : null,
              ),
              TextFormField(
                controller: _phoneController,
                decoration: const InputDecoration(labelText: '电话'),
                validator: (value) => value?.isEmpty == true ? '必填' : null,
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: _coopStatus,
                decoration: const InputDecoration(labelText: '合作状态'),
                items: const [
                  DropdownMenuItem(value: 'none', child: Text('无合作')),
                  DropdownMenuItem(value: 'cooperating', child: Text('合作中')),
                  DropdownMenuItem(value: 'finished', child: Text('已结束')),
                ],
                onChanged: (value) => setState(() => _coopStatus = value ?? 'none'),
              ),
              TextFormField(
                controller: _coopExpireAtController,
                decoration: const InputDecoration(labelText: '合作到期时间 (可选)'),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('取消'),
        ),
        TextButton(
          onPressed: () {
            if (_formKey.currentState?.validate() == true) {
              Navigator.pop(
                context,
                Store(
                  id: widget.store?.id ?? '',
                  name: _nameController.text,
                  owner: _ownerController.text,
                  address: _addressController.text,
                  phone: _phoneController.text,
                  coopStatus: _coopStatus,
                  coopExpireAt: _coopExpireAtController.text.isEmpty ? null : _coopExpireAtController.text,
                  createdAt: widget.store?.createdAt ?? '',
                ),
              );
            }
          },
          child: const Text('保存'),
        ),
      ],
    );
  }
}

// 版本管理页面
class VersionsPage extends StatefulWidget {
  const VersionsPage({super.key});

  @override
  State<VersionsPage> createState() => _VersionsPageState();
}

class _VersionsPageState extends State<VersionsPage> {
  final ApiClient _apiClient = ApiClient();
  List<Version> _versions = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadVersions();
  }

  Future<void> _loadVersions() async {
    setState(() => _isLoading = true);
    final versions = await _apiClient.getVersions();
    setState(() {
      _versions = versions;
      _isLoading = false;
    });
  }

  Future<void> _createVersion() async {
    final result = await showDialog<Version>(
      context: context,
      builder: (context) => const VersionDialog(),
    );
    if (result != null) {
      await _apiClient.createVersion(result);
      _loadVersions();
    }
  }

  @override
  void dispose() {
    _apiClient.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('版本管控'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadVersions,
          ),
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: _createVersion,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _versions.isEmpty
              ? const Center(child: Text('暂无版本数据'))
              : ListView.builder(
                  itemCount: _versions.length,
                  itemBuilder: (context, index) {
                    final version = _versions[index];
                    return ListTile(
                      title: Text(version.version),
                      subtitle: Text(version.description),
                      trailing: Chip(
                        label: Text('ID: ${version.id}'),
                      ),
                    );
                  },
                ),
    );
  }
}

class VersionDialog extends StatefulWidget {
  final Version? version;

  const VersionDialog({super.key, this.version});

  @override
  State<VersionDialog> createState() => _VersionDialogState();
}

class _VersionDialogState extends State<VersionDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _versionController;
  late final TextEditingController _descriptionController;

  @override
  void initState() {
    super.initState();
    _versionController = TextEditingController(text: widget.version?.version);
    _descriptionController = TextEditingController(text: widget.version?.description);
  }

  @override
  void dispose() {
    _versionController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.version == null ? '新增版本' : '编辑版本'),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              controller: _versionController,
              decoration: const InputDecoration(labelText: '版本号'),
              validator: (value) => value?.isEmpty == true ? '必填' : null,
            ),
            TextFormField(
              controller: _descriptionController,
              decoration: const InputDecoration(labelText: '描述'),
              validator: (value) => value?.isEmpty == true ? '必填' : null,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('取消'),
        ),
        TextButton(
          onPressed: () {
            if (_formKey.currentState?.validate() == true) {
              Navigator.pop(
                context,
                Version(
                  id: widget.version?.id ?? '',
                  version: _versionController.text,
                  description: _descriptionController.text,
                  createdAt: widget.version?.createdAt ?? '',
                ),
              );
            }
          },
          child: const Text('保存'),
        ),
      ],
    );
  }
}

// 故障记录页面
class IssuesPage extends StatefulWidget {
  const IssuesPage({super.key});

  @override
  State<IssuesPage> createState() => _IssuesPageState();
}

class _IssuesPageState extends State<IssuesPage> {
  final ApiClient _apiClient = ApiClient();
  List<Issue> _issues = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadIssues();
  }

  Future<void> _loadIssues() async {
    setState(() => _isLoading = true);
    final issues = await _apiClient.getIssues();
    setState(() {
      _issues = issues;
      _isLoading = false;
    });
  }

  Future<void> _createIssue() async {
    final result = await showDialog<Issue>(
      context: context,
      builder: (context) => const IssueDialog(),
    );
    if (result != null) {
      await _apiClient.createIssue(result);
      _loadIssues();
    }
  }

  Future<void> _updateIssue(Issue issue) async {
    final result = await showDialog<Issue>(
      context: context,
      builder: (context) => IssueDialog(issue: issue),
    );
    if (result != null) {
      await _apiClient.updateIssue(issue.id, result);
      _loadIssues();
    }
  }

  @override
  void dispose() {
    _apiClient.dispose();
    super.dispose();
  }

  String _getIssueStatusLabel(String status) {
    switch (status) {
      case 'fixed':
        return '已修复';
      case 'ignore':
        return '已忽略';
      default:
        return '待处理';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('故障记录'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadIssues,
          ),
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: _createIssue,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _issues.isEmpty
              ? const Center(child: Text('暂无故障记录'))
              : ListView.builder(
                  itemCount: _issues.length,
                  itemBuilder: (context, index) {
                    final issue = _issues[index];
                    return ListTile(
                      title: Text(issue.title),
                      subtitle: Text(issue.description),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Chip(label: Text(_getIssueStatusLabel(issue.status))),
                          IconButton(
                            icon: const Icon(Icons.edit),
                            onPressed: () => _updateIssue(issue),
                          ),
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}

class IssueDialog extends StatefulWidget {
  final Issue? issue;

  const IssueDialog({super.key, this.issue});

  @override
  State<IssueDialog> createState() => _IssueDialogState();
}

class _IssueDialogState extends State<IssueDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _titleController;
  late final TextEditingController _descriptionController;
  String _status = 'open';

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.issue?.title);
    _descriptionController = TextEditingController(text: widget.issue?.description);
    _status = widget.issue?.status ?? 'open';
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.issue == null ? '新增故障' : '编辑故障'),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              controller: _titleController,
              decoration: const InputDecoration(labelText: '标题'),
              validator: (value) => value?.isEmpty == true ? '必填' : null,
            ),
            TextFormField(
              controller: _descriptionController,
              decoration: const InputDecoration(labelText: '描述'),
              maxLines: 3,
              validator: (value) => value?.isEmpty == true ? '必填' : null,
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: _status,
              decoration: const InputDecoration(labelText: '状态'),
              items: const [
                DropdownMenuItem(value: 'open', child: Text('待处理')),
                DropdownMenuItem(value: 'fixed', child: Text('已修复')),
                DropdownMenuItem(value: 'ignore', child: Text('已忽略')),
              ],
              onChanged: (value) => setState(() => _status = value ?? 'open'),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('取消'),
        ),
        TextButton(
          onPressed: () {
            if (_formKey.currentState?.validate() == true) {
              Navigator.pop(
                context,
                Issue(
                  id: widget.issue?.id ?? '',
                  title: _titleController.text,
                  description: _descriptionController.text,
                  status: _status,
                  createdAt: widget.issue?.createdAt ?? '',
                ),
              );
            }
          },
          child: const Text('保存'),
        ),
      ],
    );
  }
}

// 产物管理页面
class ArtifactsPage extends StatelessWidget {
  const ArtifactsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('编译产物管理'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () {},
          ),
        ],
      ),
      body: const Center(
        child: Text('编译产物管理', style: TextStyle(fontSize: 24)),
      ),
    );
  }
}