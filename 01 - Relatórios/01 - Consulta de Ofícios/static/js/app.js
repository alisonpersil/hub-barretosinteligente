/**
 * Sistema de Consulta de Ofícios - Frontend Logic
 * Estilo ChatGPT / OpenAI Interface com suporte a Importação e Exclusão
 */

// Application State
const state = {
    allDocuments: [],
    filteredDocuments: [],
    activeMainTab: 'protocolos', // 'protocolos' | 'oficios' | 'todos'
    searchTerm: '',
    activeFilterChip: 'all',
    currentSort: 'mtime_desc',
    currentView: 'table', // 'table' | 'cards' (Padrão: Lista)
    activeModalDoc: null,
    activeModalFile: null,
    docToDelete: null,
    currentPage: 1,
    pageSize: 15
};

let selectedImportFiles = [];
let currentImportDestination = 'oficios'; // 'oficios' | 'protocolos'
let currentImportMode = 'files'; // 'files' | 'folder'

// DOM Elements
const moduleTabBtns = document.querySelectorAll('.module-tab-btn');
const badgeCountProtocolos = document.getElementById('badgeCountProtocolos');
const badgeCountOficios = document.getElementById('badgeCountOficios');
const badgeCountTodos = document.getElementById('badgeCountTodos');

const searchInput = document.getElementById('searchInput');
const btnClearSearch = document.getElementById('btnClearSearch');
const btnSearchSubmit = document.getElementById('btnSearchSubmit');
const filterChips = document.querySelectorAll('.chip');
const sortSelect = document.getElementById('sortSelect');
const btnViewCards = document.getElementById('btnViewCards');
const btnViewList = document.getElementById('btnViewList');
const resultsCounter = document.getElementById('resultsCounter');
const activeFilterTag = document.getElementById('activeFilterTag');
const activeFilterText = document.getElementById('activeFilterText');
const btnRemoveFilter = document.getElementById('btnRemoveFilter');
const paginationContainer = document.getElementById('paginationContainer');

const documentsCardsContainer = document.getElementById('documentsCardsContainer');
const documentsTableContainer = document.getElementById('documentsTableContainer');
const documentsTableBody = document.getElementById('documentsTableBody');
const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const btnClearSearchEmpty = document.getElementById('btnClearSearchEmpty');

const btnRefresh = document.getElementById('btnRefresh');
const btnSyncCidadao = document.getElementById('btnSyncCidadao');
const btnThemeToggle = document.getElementById('btnThemeToggle');
const headerDocCount = document.getElementById('headerDocCount');

// Protocol & Preview Modal Elements
const previewModal = document.getElementById('previewModal');
const modalDocTitle = document.getElementById('modalDocTitle');
const modalDocMeta = document.getElementById('modalDocMeta');
const btnModalDownloadZip = document.getElementById('btnModalDownloadZip');
const btnModalDelete = document.getElementById('btnModalDelete');
const btnModalClose = document.getElementById('btnModalClose');
const protocolFilesPanel = document.getElementById('protocolFilesPanel');
const protocolFilesSearchInput = document.getElementById('protocolFilesSearchInput');
const btnClearProtocolFilesSearch = document.getElementById('btnClearProtocolFilesSearch');
const protocolFilesCount = document.getElementById('protocolFilesCount');
const protocolFilesList = document.getElementById('protocolFilesList');
const protocolPreviewPanel = document.getElementById('protocolPreviewPanel');
const activeDocName = document.getElementById('activeDocName');
const activeDocMeta = document.getElementById('activeDocMeta');
const btnActiveDocDownload = document.getElementById('btnActiveDocDownload');
const btnActiveDocNewTab = document.getElementById('btnActiveDocNewTab');
const btnBackToFilesList = document.getElementById('btnBackToFilesList');
const emptyFileSelectedState = document.getElementById('emptyFileSelectedState');
const pdfViewerFrame = document.getElementById('pdfViewerFrame');
const modalLoading = document.getElementById('modalLoading');
const btnMobileOpenPdf = document.getElementById('btnMobileOpenPdf');
const toastContainer = document.getElementById('toastContainer');

// Import Modal Elements
const btnOpenImportModal = document.getElementById('btnOpenImportModal');
const importModal = document.getElementById('importModal');
const btnImportModalClose = document.getElementById('btnImportModalClose');
const btnCancelImport = document.getElementById('btnCancelImport');
const btnStartImport = document.getElementById('btnStartImport');
const tabImportFiles = document.getElementById('tabImportFiles');
const tabImportFolder = document.getElementById('tabImportFolder');
const destTabBtns = document.querySelectorAll('.dest-tab-btn');
const destOficios = document.getElementById('destOficios');
const destProtocolos = document.getElementById('destProtocolos');
const protocolDestinationInputGroup = document.getElementById('protocolDestinationInputGroup');
const protocolFolderNameInput = document.getElementById('protocolFolderNameInput');
const existingProtocolosDatalist = document.getElementById('existingProtocolosDatalist');
const importModalTitle = document.getElementById('importModalTitle');
const dropZone = document.getElementById('dropZone');
const dropZoneTitle = document.getElementById('dropZoneTitle');
const dropZoneDesc = document.getElementById('dropZoneDesc');
const btnBrowseFiles = document.getElementById('btnBrowseFiles');
const fileInputMultiple = document.getElementById('fileInputMultiple');
const fileInputFolder = document.getElementById('fileInputFolder');
const importFileListContainer = document.getElementById('importFileListContainer');
const importFileList = document.getElementById('importFileList');
const importFileCount = document.getElementById('importFileCount');
const btnClearImportList = document.getElementById('btnClearImportList');
const importProgressBarContainer = document.getElementById('importProgressBarContainer');
const importProgressFill = document.getElementById('importProgressFill');
const importProgressLabel = document.getElementById('importProgressLabel');

// Cloud / GitHub Settings Elements
const btnToggleGithubSettings = document.getElementById('btnToggleGithubSettings');
const cloudSettingsCard = document.getElementById('cloudSettingsCard');
const githubSettingsBody = document.getElementById('githubSettingsBody');
const githubSettingsChevron = document.getElementById('githubSettingsChevron');
const githubTokenInput = document.getElementById('githubTokenInput');
const btnSaveGithubToken = document.getElementById('btnSaveGithubToken');
const cloudStatusText = document.getElementById('cloudStatusText');
const cloudStatusTitle = document.getElementById('cloudStatusTitle');
const cloudStatusSubtitle = document.getElementById('cloudStatusSubtitle');
const importNoticeAlert = document.getElementById('importNoticeAlert');
const importNoticeMessage = document.getElementById('importNoticeMessage');

// Delete Modal Elements
const deleteModal = document.getElementById('deleteModal');
const deleteDocName = document.getElementById('deleteDocName');
const btnCancelDelete = document.getElementById('btnCancelDelete');
const btnConfirmDelete = document.getElementById('btnConfirmDelete');

// ==========================================================================
// Initialization
// ==========================================================================
let appInitialized = false;
function initApp() {
    if (appInitialized) return;
    appInitialized = true;
    initTheme();
    loadDocuments();
    setupEventListeners();
    checkSystemStatus();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// ==========================================================================
// Event Listeners Setup
// ==========================================================================
function setupEventListeners() {
    // Real-time Search Input
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.searchTerm = e.target.value.trim();
            toggleClearButton();
            applyFiltersAndRender();
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                scrollToResults();
            }
        });
    }

    if (btnClearSearch) {
        btnClearSearch.addEventListener('click', clearSearch);
    }

    if (btnClearSearchEmpty) {
        btnClearSearchEmpty.addEventListener('click', clearSearch);
    }

    if (btnSearchSubmit) {
        btnSearchSubmit.addEventListener('click', scrollToResults);
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        } else if (e.key === 'Escape') {
            if (deleteModal && !deleteModal.classList.contains('hidden')) {
                closeDeleteModal();
            } else if (importModal && !importModal.classList.contains('hidden')) {
                closeImportModal();
            } else if (previewModal && !previewModal.classList.contains('hidden')) {
                closeModal();
            } else if (searchInput && searchInput.value) {
                clearSearch();
            }
        }
    });

    // Module Tabs: Protocolos vs Ofícios vs Todos
    moduleTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            moduleTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeMainTab = btn.dataset.mainTab || 'protocolos';
            updateModuleTabCounts();
            applyFiltersAndRender(true);
        });
    });

    // Filter Chips
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.activeFilterChip = chip.dataset.filter;
            applyFiltersAndRender();
        });
    });

    if (btnRemoveFilter) {
        btnRemoveFilter.addEventListener('click', () => {
            const allChip = document.querySelector('.chip[data-filter="all"]');
            if (allChip) allChip.click();
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            state.currentSort = e.target.value;
            updateSortHeadersUI();
            applyFiltersAndRender();
        });
    }

    // Interactive Table Header Sorting
    const sortableHeaders = document.querySelectorAll('.documents-table th.sortable-th');
    sortableHeaders.forEach(th => {
        th.onclick = (e) => {
            e.preventDefault();
            const sortKey = th.getAttribute('data-sort');
            if (sortKey) {
                handleHeaderSort(sortKey);
            }
        };
    });

    if (btnViewCards) {
        btnViewCards.addEventListener('click', () => setViewMode('cards'));
    }

    if (btnViewList) {
        btnViewList.addEventListener('click', () => setViewMode('table'));
    }

    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            const icon = btnRefresh.querySelector('i');
            if (icon) icon.classList.add('fa-spin');
            loadDocuments(true).then(() => {
                setTimeout(() => {
                    if (icon) icon.classList.remove('fa-spin');
                    showToast('Lista de documentos atualizada!', 'success');
                }, 400);
            });
        });
    }

    if (btnSyncCidadao) {
        btnSyncCidadao.addEventListener('click', async () => {
            const icon = btnSyncCidadao.querySelector('i');
            const textSpan = btnSyncCidadao.querySelector('.btn-sync-text');
            const oldText = textSpan ? textSpan.textContent : 'Sincronizar Portal';

            btnSyncCidadao.disabled = true;
            btnSyncCidadao.classList.add('syncing');
            if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
            if (textSpan) textSpan.textContent = 'Sincronizando...';

            showToast('Conectando ao Cidadão Online de Barretos...', 'info');

            try {
                const token = localStorage.getItem('pmo_github_token') || '';
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['X-GitHub-Token'] = token;

                const res = await fetch('/api/sync/cidadao-online?ano=2026', {
                    method: 'POST',
                    headers: headers
                });

                if (!res.ok) {
                    throw new Error(`Erro ${res.status}: falha na comunicação com o servidor`);
                }

                const data = await res.json();
                if (data.status === 'success') {
                    const msg = `Sincronização concluída! ${data.protocols_added || 0} novo(s) protocolo(s), ${data.statuses_updated || 0} status atualizado(s) e ${data.files_added || 0} novo(s) anexo(s).`;
                    showToast(msg, 'success', 6000);
                    await loadDocuments(true);
                } else {
                    showToast(data.message || data.error || 'Erro na sincronização.', 'error', 5000);
                }
            } catch (err) {
                console.error('Erro na sincronização Cidadão Online:', err);
                showToast(`Erro ao sincronizar: ${err.message}`, 'error', 5000);
            } finally {
                btnSyncCidadao.disabled = false;
                btnSyncCidadao.classList.remove('syncing');
                if (icon) icon.className = 'fa-solid fa-arrows-rotate';
                if (textSpan) textSpan.textContent = oldText;
            }
        });
    }

    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', toggleTheme);
    }

    // Protocol Explorer Modal Events
    if (btnModalClose) btnModalClose.addEventListener('click', closeModal);
    if (previewModal) {
        previewModal.addEventListener('click', (e) => {
            if (e.target === previewModal) closeModal();
        });
    }

    if (pdfViewerFrame) {
        pdfViewerFrame.addEventListener('load', () => {
            if (modalLoading) modalLoading.classList.add('hidden');
        });
    }

    if (btnModalDownloadZip) {
        btnModalDownloadZip.addEventListener('click', () => {
            if (state.activeModalDoc) {
                if (state.activeModalDoc.doc_type === 'oficio') {
                    downloadDocument(state.activeModalDoc);
                } else {
                    downloadProtocolZip(state.activeModalDoc);
                }
            }
        });
    }

    if (btnModalDelete) {
        btnModalDelete.addEventListener('click', () => {
            if (state.activeModalDoc) openDeleteModal(state.activeModalDoc);
        });
    }

    if (protocolFilesSearchInput) {
        protocolFilesSearchInput.addEventListener('input', (e) => {
            const term = e.target.value.trim().toLowerCase();
            if (btnClearProtocolFilesSearch) {
                btnClearProtocolFilesSearch.classList.toggle('hidden', !term);
            }
            filterProtocolFilesList(term);
        });
    }

    if (btnClearProtocolFilesSearch) {
        btnClearProtocolFilesSearch.addEventListener('click', () => {
            if (protocolFilesSearchInput) {
                protocolFilesSearchInput.value = '';
                btnClearProtocolFilesSearch.classList.add('hidden');
                filterProtocolFilesList('');
                protocolFilesSearchInput.focus();
            }
        });
    }

    if (btnBackToFilesList) {
        btnBackToFilesList.addEventListener('click', () => {
            if (protocolPreviewPanel) protocolPreviewPanel.classList.remove('mobile-visible');
        });
    }

    if (btnActiveDocDownload) {
        btnActiveDocDownload.addEventListener('click', () => {
            if (state.activeModalFile) downloadDocument(state.activeModalFile);
        });
    }

    // Delete Modal Events
    if (btnCancelDelete) btnCancelDelete.addEventListener('click', closeDeleteModal);
    if (btnConfirmDelete) btnConfirmDelete.addEventListener('click', confirmDelete);
    if (deleteModal) {
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) closeDeleteModal();
        });
    }

    // Import Modal Events
    if (btnOpenImportModal) btnOpenImportModal.addEventListener('click', openImportModal);
    if (btnImportModalClose) btnImportModalClose.addEventListener('click', closeImportModal);
    if (btnCancelImport) btnCancelImport.addEventListener('click', closeImportModal);
    if (btnStartImport) btnStartImport.addEventListener('click', startImportUpload);
    if (btnClearImportList) btnClearImportList.addEventListener('click', clearImportSelection);
    if (importModal) {
        importModal.addEventListener('click', (e) => {
            if (e.target === importModal) closeImportModal();
        });
    }

    // Destination Tabs Switcher (Ofícios vs Protocolos)
    destTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            destTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentImportDestination = btn.dataset.destination || 'oficios';
            updateImportDestinationUI();
        });
    });

    // Import Tabs Switcher (Files vs Folder)
    if (tabImportFiles && tabImportFolder) {
        tabImportFiles.addEventListener('click', () => {
            tabImportFiles.classList.add('active');
            tabImportFolder.classList.remove('active');
            currentImportMode = 'files';
            updateImportDestinationUI();
        });

        tabImportFolder.addEventListener('click', () => {
            tabImportFolder.classList.add('active');
            tabImportFiles.classList.remove('active');
            currentImportMode = 'folder';
            updateImportDestinationUI();
        });
    }

    // Browse Button
    if (btnBrowseFiles) {
        btnBrowseFiles.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentImportMode === 'folder' && fileInputFolder) {
                fileInputFolder.click();
            } else if (fileInputMultiple) {
                fileInputMultiple.click();
            }
        });
    }

    if (dropZone) {
        dropZone.addEventListener('click', () => {
            if (currentImportMode === 'folder' && fileInputFolder) {
                fileInputFolder.click();
            } else if (fileInputMultiple) {
                fileInputMultiple.click();
            }
        });

        // Drag & Drop
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-over');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                handleFilesSelected(dt.files);
            }
        });
    }

    if (fileInputMultiple) {
        fileInputMultiple.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFilesSelected(e.target.files);
            }
        });
    }

    if (fileInputFolder) {
        fileInputFolder.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFilesSelected(e.target.files);
            }
        });
    }

    // GitHub Settings
    if (btnToggleGithubSettings) {
        btnToggleGithubSettings.addEventListener('click', () => toggleGithubSettings());
    }

    if (btnSaveGithubToken) {
        btnSaveGithubToken.addEventListener('click', () => {
            const token = githubTokenInput ? githubTokenInput.value.trim() : '';
            if (token) {
                localStorage.setItem('pmo_github_token', token);
                showToast('Token do GitHub salvo com sucesso!', 'success');
                checkSystemStatus();
                toggleGithubSettings(false);
            } else {
                localStorage.removeItem('pmo_github_token');
                showToast('Token removido.', 'info');
                checkSystemStatus();
            }
        });
    }
}

function updateModuleTabCounts() {
    const protCount = state.allDocuments.filter(d => d.doc_type === 'protocolo').length;
    const oficiosCount = state.allDocuments.filter(d => d.doc_type === 'oficio').length;
    const totalCount = state.allDocuments.length;

    if (badgeCountProtocolos) badgeCountProtocolos.textContent = protCount;
    if (badgeCountOficios) badgeCountOficios.textContent = oficiosCount;
    if (badgeCountTodos) badgeCountTodos.textContent = totalCount;

    if (headerDocCount) {
        if (state.activeMainTab === 'protocolos') {
            headerDocCount.textContent = `${protCount} protocolos`;
        } else if (state.activeMainTab === 'oficios') {
            headerDocCount.textContent = `${oficiosCount} ofícios`;
        } else {
            headerDocCount.textContent = `${totalCount} documentos`;
        }
    }
}

// ==========================================================================
// Data Fetching & API
// ==========================================================================
async function loadDocuments(forceFetch = false) {
    if (!forceFetch && window.INITIAL_DOCS && Array.isArray(window.INITIAL_DOCS) && window.INITIAL_DOCS.length > 0) {
        state.allDocuments = window.INITIAL_DOCS;
        updateModuleTabCounts();
        if (loadingState) loadingState.classList.add('hidden');
        applyFiltersAndRender();
        return;
    }

    if (loadingState) loadingState.classList.remove('hidden');
    if (documentsCardsContainer) documentsCardsContainer.classList.add('hidden');
    if (documentsTableContainer) documentsTableContainer.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');

    try {
        const response = await fetch('/api/oficios');
        const data = await response.json();

        if (data.success && Array.isArray(data.documents)) {
            state.allDocuments = data.documents;
            updateModuleTabCounts();
            applyFiltersAndRender();
        } else {
            showToast('Erro ao carregar lista de documentos', 'error');
        }
    } catch (error) {
        console.error('Erro ao buscar documentos:', error);
        showToast('Não foi possível conectar ao servidor', 'error');
    } finally {
        if (loadingState) loadingState.classList.add('hidden');
    }
}

// Download full protocol as ZIP archive
function downloadProtocolZip(protocol) {
    showToast(`Preparando arquivo ZIP de "${protocol.name}"...`, 'info');
    const pathParts = (protocol.relative_path || protocol.name).split('/').map(encodeURIComponent).join('/');
    const downloadUrl = `/api/protocolo/download-zip/${pathParts}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${protocol.folder_name || protocol.name}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Download individual document file
function downloadDocument(doc) {
    showToast(`Iniciando download de "${doc.name}"...`, 'info');
    const pathParts = (doc.relative_path || doc.name).split('/').map(encodeURIComponent).join('/');
    const downloadUrl = `/api/pdf/download/${pathParts}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ==========================================================================
// Filtering & Sorting Logic
// ==========================================================================
function normalizeText(text) {
    if (!text) return '';
    return text.toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function getTypeWords(count = 1) {
    if (state.activeMainTab === 'protocolos') {
        return {
            single: 'protocolo',
            plural: count === 1 ? 'protocolo' : 'protocolos'
        };
    } else if (state.activeMainTab === 'oficios') {
        return {
            single: 'ofício',
            plural: count === 1 ? 'ofício' : 'ofícios'
        };
    } else {
        return {
            single: 'item',
            plural: count === 1 ? 'item' : 'itens'
        };
    }
}

function applyFiltersAndRender(resetPage = true) {
    if (resetPage) {
        state.currentPage = 1;
    }
    let result = [...state.allDocuments];

    // 0. Main Tab Filter (Protocolos vs Ofícios vs Todos)
    if (state.activeMainTab === 'protocolos') {
        result = result.filter(doc => doc.doc_type === 'protocolo');
    } else if (state.activeMainTab === 'oficios') {
        result = result.filter(doc => doc.doc_type === 'oficio');
    }

    const searchNormalized = normalizeText(state.searchTerm);
    const searchTokens = searchNormalized.split(/\s+/).filter(t => t.length > 0);

    // 1. Text Search Filter (Matches Protocol name, code, subject, and inner file names!)
    if (searchTokens.length > 0) {
        result = result.filter(doc => {
            const docNameNorm = normalizeText(doc.name);
            const docCategoryNorm = normalizeText(doc.category);
            const docProtNorm = normalizeText(doc.protocolo);
            const docAssuntoNorm = normalizeText(doc.assunto);

            // Check if matches top-level info
            const matchesProtocol = searchTokens.every(token => 
                docNameNorm.includes(token) || 
                docCategoryNorm.includes(token) ||
                docProtNorm.includes(token) ||
                docAssuntoNorm.includes(token)
            );

            if (matchesProtocol) {
                doc.matched_file_name = null;
                return true;
            }

            // Check if any file inside matches
            if (doc.files && Array.isArray(doc.files)) {
                for (const f of doc.files) {
                    const fNameNorm = normalizeText(f.name);
                    if (searchTokens.every(token => fNameNorm.includes(token))) {
                        doc.matched_file_name = f.name;
                        return true;
                    }
                }
            }

            return false;
        });
    } else {
        result.forEach(doc => { doc.matched_file_name = null; });
    }

    // 2. Chip Filter
    if (state.activeFilterChip && state.activeFilterChip !== 'all') {
        const filterKey = state.activeFilterChip;
        result = result.filter(doc => {
            const nameNorm = normalizeText(doc.name);
            const catNorm = normalizeText(doc.category);
            const statusNorm = normalizeText(doc.status);

            if (filterKey === '2026') return nameNorm.includes('2026') || doc.year === '2026';
            if (filterKey === 'pagamento') return catNorm.includes('pagamento') || nameNorm.includes('pagamento') || nameNorm.includes('parcela');
            if (filterKey === 'iluminacao') return catNorm.includes('ilumina') || nameNorm.includes('ilumina') || nameNorm.includes('dimeriza') || nameNorm.includes('destaque');
            if (filterKey === 'videomonitoramento') return catNorm.includes('videomonitoramento') || nameNorm.includes('videomonitoramento') || nameNorm.includes('camera') || nameNorm.includes('câmera') || nameNorm.includes('facial');
            if (filterKey === 'fotovoltaico') return catNorm.includes('fotovoltaico') || nameNorm.includes('fotovoltaico') || nameNorm.includes('carport');
            if (filterKey === 'deferido') return statusNorm === 'deferido' || nameNorm.includes('(deferido)');
            if (filterKey === 'indeferido') return statusNorm === 'indeferido' || nameNorm.includes('(indeferido)');
            if (filterKey === 'reajuste') return catNorm.includes('reajuste') || nameNorm.includes('reajuste') || nameNorm.includes('prm');
            if (filterKey === 'aditivo') return catNorm.includes('aditivo') || nameNorm.includes('aditivo') || nameNorm.includes('termo');
            return true;
        });

        if (activeFilterTag) activeFilterTag.classList.remove('hidden');
        if (activeFilterText) activeFilterText.textContent = getFilterLabel(filterKey);
    } else {
        if (activeFilterTag) activeFilterTag.classList.add('hidden');
    }

    // 3. Sorting
    result.sort((a, b) => {
        switch (state.currentSort) {
            case 'name_asc':
                return a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' });
            case 'name_desc':
                return b.name.localeCompare(a.name, 'pt-BR', { numeric: true, sensitivity: 'base' });
            case 'assunto_asc': {
                const aAssunto = a.assunto || a.name || '';
                const bAssunto = b.assunto || b.name || '';
                return aAssunto.localeCompare(bAssunto, 'pt-BR', { numeric: true, sensitivity: 'base' });
            }
            case 'assunto_desc': {
                const aAssunto = a.assunto || a.name || '';
                const bAssunto = b.assunto || b.name || '';
                return bAssunto.localeCompare(aAssunto, 'pt-BR', { numeric: true, sensitivity: 'base' });
            }
            case 'files_desc':
            case 'arquivos_desc': {
                const aCount = a.total_files || (a.files ? a.files.length : 1);
                const bCount = b.total_files || (b.files ? b.files.length : 1);
                return (bCount - aCount) || ((b.size_bytes || 0) - (a.size_bytes || 0));
            }
            case 'files_asc':
            case 'arquivos_asc': {
                const aCount = a.total_files || (a.files ? a.files.length : 1);
                const bCount = b.total_files || (b.files ? b.files.length : 1);
                return (aCount - bCount) || ((a.size_bytes || 0) - (b.size_bytes || 0));
            }
            case 'ctime_desc':
                return (b.doc_date_ts || b.ctime || 0) - (a.doc_date_ts || a.ctime || 0);
            case 'ctime_asc':
                return (a.doc_date_ts || a.ctime || 0) - (b.doc_date_ts || b.ctime || 0);
            case 'mtime_desc':
            case 'data_desc': {
                const diff = (b.doc_date_ts || b.mtime || 0) - (a.doc_date_ts || a.mtime || 0);
                if (diff !== 0) return diff;
                return (b.name || '').localeCompare(a.name || '', 'pt-BR', { numeric: true });
            }
            case 'mtime_asc':
            case 'data_asc': {
                const diff = (a.doc_date_ts || a.mtime || 0) - (b.doc_date_ts || b.mtime || 0);
                if (diff !== 0) return diff;
                return (a.name || '').localeCompare(b.name || '', 'pt-BR', { numeric: true });
            }
            case 'size_desc':
                return (b.size_bytes || 0) - (a.size_bytes || 0);
            case 'size_asc':
                return (a.size_bytes || 0) - (b.size_bytes || 0);
            default: {
                const diff = (b.doc_date_ts || b.mtime || 0) - (a.doc_date_ts || a.mtime || 0);
                if (diff !== 0) return diff;
                return (b.name || '').localeCompare(a.name || '', 'pt-BR', { numeric: true });
            }
        }
    });

    state.filteredDocuments = result;
    renderResults();
}

function updateSortHeadersUI() {
    const current = state.currentSort;
    const sortableHeaders = document.querySelectorAll('.documents-table th.sortable-th');

    sortableHeaders.forEach(th => {
        const sortType = th.getAttribute('data-sort');
        const icon = th.querySelector('.sort-icon');
        let isActive = false;
        let isAsc = false;
        let titleText = '';

        if (sortType === 'name' && (current === 'name_asc' || current === 'name_desc')) {
            isActive = true;
            isAsc = (current === 'name_asc');
            titleText = isAsc ? 'Ordenado por Nome (A→Z). Clique para ordenar de Z→A' : 'Ordenado por Nome (Z→A). Clique para ordenar de A→Z';
        } else if (sortType === 'assunto' && (current === 'assunto_asc' || current === 'assunto_desc')) {
            isActive = true;
            isAsc = (current === 'assunto_asc');
            titleText = isAsc ? 'Ordenado por Assunto (A→Z). Clique para ordenar de Z→A' : 'Ordenado por Assunto (Z→A). Clique para ordenar de A→Z';
        } else if (sortType === 'arquivos' && (current === 'files_desc' || current === 'files_asc' || current === 'arquivos_desc' || current === 'arquivos_asc')) {
            isActive = true;
            isAsc = (current === 'files_asc' || current === 'arquivos_asc');
            titleText = isAsc ? 'Ordenado: Menos arquivos primeiro. Clique para Mais arquivos' : 'Ordenado: Mais arquivos primeiro. Clique para Menos arquivos';
        } else if (sortType === 'data' && (current === 'mtime_desc' || current === 'mtime_asc' || current === 'data_desc' || current === 'data_asc')) {
            isActive = true;
            isAsc = (current === 'mtime_asc' || current === 'data_asc');
            titleText = isAsc ? 'Ordenado: Mais antiga primeiro. Clique para ordenar do Mais recente' : 'Ordenado: Mais recente primeiro. Clique para ordenar do Mais antigo';
        } else {
            if (sortType === 'name') titleText = 'Clique para ordenar por Protocolo / Pasta';
            if (sortType === 'assunto') titleText = 'Clique para ordenar por Assunto';
            if (sortType === 'arquivos') titleText = 'Clique para ordenar por Quantidade de Arquivos';
            if (sortType === 'data') titleText = 'Clique para ordenar por Data do Documento';
        }

        th.setAttribute('title', titleText);

        if (isActive) {
            th.classList.add('active');
            if (icon) {
                icon.className = `fa-solid ${isAsc ? 'fa-sort-up' : 'fa-sort-down'} sort-icon`;
            }
        } else {
            th.classList.remove('active');
            if (icon) {
                icon.className = 'fa-solid fa-sort sort-icon';
            }
        }
    });
}

function handleHeaderSort(sortKey) {
    let nextSort = '';

    if (sortKey === 'name') {
        nextSort = (state.currentSort === 'name_asc') ? 'name_desc' : 'name_asc';
    } else if (sortKey === 'assunto') {
        nextSort = (state.currentSort === 'assunto_asc') ? 'assunto_desc' : 'assunto_asc';
    } else if (sortKey === 'arquivos') {
        nextSort = (state.currentSort === 'files_desc' || state.currentSort === 'arquivos_desc') ? 'files_asc' : 'files_desc';
    } else if (sortKey === 'data') {
        if (state.currentSort === 'mtime_desc' || state.currentSort === 'data_desc') {
            nextSort = 'mtime_asc';
        } else {
            nextSort = 'mtime_desc';
        }
    }

    if (nextSort) {
        state.currentSort = nextSort;
        if (sortSelect) {
            sortSelect.value = nextSort;
        }
        updateSortHeadersUI();
        applyFiltersAndRender(true);

        if (sortKey === 'data') {
            if (nextSort === 'mtime_desc') {
                showToast('Ordenado: Data mais recente primeiro', 'info');
            } else {
                showToast('Ordenado: Data mais antiga primeiro', 'info');
            }
        } else if (sortKey === 'name') {
            showToast(nextSort === 'name_asc' ? 'Ordenado por Nome (A→Z)' : 'Ordenado por Nome (Z→A)', 'info');
        } else if (sortKey === 'assunto') {
            showToast(nextSort === 'assunto_asc' ? 'Ordenado por Assunto (A→Z)' : 'Ordenado por Assunto (Z→A)', 'info');
        } else if (sortKey === 'arquivos') {
            showToast(nextSort === 'files_desc' ? 'Ordenado: Mais arquivos primeiro' : 'Ordenado: Menos arquivos primeiro', 'info');
        }
    }
}

function getFilterLabel(filterKey) {
    const chip = document.querySelector(`.chip[data-filter="${filterKey}"]`);
    return chip ? chip.textContent.trim() : filterKey;
}

// ==========================================================================
// Rendering Results & Pagination (15 por página)
// ==========================================================================
function renderResults() {
    updateSortHeadersUI();
    const total = state.allDocuments.length;
    const count = state.filteredDocuments.length;
    const typeWords = getTypeWords(count);

    if (count === 0) {
        if (resultsCounter) {
            resultsCounter.innerHTML = `Nenhum ${typeWords.single} encontrado`;
        }
        if (documentsCardsContainer) documentsCardsContainer.classList.add('hidden');
        if (documentsTableContainer) documentsTableContainer.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        if (paginationContainer) paginationContainer.classList.add('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    const totalPages = Math.ceil(count / state.pageSize) || 1;
    if (state.currentPage > totalPages) {
        state.currentPage = totalPages;
    }
    if (state.currentPage < 1) {
        state.currentPage = 1;
    }

    const startIndex = (state.currentPage - 1) * state.pageSize;
    const endIndex = Math.min(startIndex + state.pageSize, count);
    const pagedDocuments = state.filteredDocuments.slice(startIndex, endIndex);

    const totalDocsInFiltered = state.filteredDocuments.reduce((sum, p) => sum + (p.total_files || (p.files ? p.files.length : 1)), 0);

    if (resultsCounter) {
        resultsCounter.innerHTML = `Exibindo <strong>${startIndex + 1}–${endIndex}</strong> de <strong>${count}</strong> ${typeWords.plural} (${totalDocsInFiltered} documentos indexados)`;
    }

    if (state.currentView === 'cards') {
        renderCardsView(pagedDocuments);
        if (documentsCardsContainer) documentsCardsContainer.classList.remove('hidden');
        if (documentsTableContainer) documentsTableContainer.classList.add('hidden');
    } else {
        renderTableView(pagedDocuments);
        if (documentsTableContainer) documentsTableContainer.classList.remove('hidden');
        if (documentsCardsContainer) documentsCardsContainer.classList.add('hidden');
    }

    renderPagination(totalPages, count, startIndex + 1, endIndex);
}

function renderPagination(totalPages, totalItems, fromItem, toItem) {
    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.classList.add('hidden');
        paginationContainer.innerHTML = '';
        return;
    }

    paginationContainer.classList.remove('hidden');

    const typeWords = getTypeWords(totalItems);

    const infoHtml = `
        <div class="pagination-info">
            Página <strong>${state.currentPage}</strong> de <strong>${totalPages}</strong>
            <span>(${totalItems} ${typeWords.plural} no total)</span>
        </div>
    `;

    let controlsHtml = '<div class="pagination-controls">';

    const prevDisabled = state.currentPage === 1 ? 'disabled' : '';
    controlsHtml += `
        <button class="pagination-btn" id="btnPagePrev" ${prevDisabled} title="Página anterior" aria-label="Página anterior">
            <i class="fa-solid fa-chevron-left"></i>
            <span>Anterior</span>
        </button>
    `;

    controlsHtml += '<div class="pagination-pages">';
    const pages = getPaginationPageNumbers(state.currentPage, totalPages);
    pages.forEach(p => {
        if (p === '...') {
            controlsHtml += `<span class="pagination-num ellipsis">&hellip;</span>`;
        } else {
            const isActive = p === state.currentPage ? 'active' : '';
            controlsHtml += `
                <button class="pagination-num ${isActive}" data-page="${p}" title="Ir para a página ${p}" aria-label="Página ${p}">
                    ${p}
                </button>
            `;
        }
    });
    controlsHtml += '</div>';

    const nextDisabled = state.currentPage === totalPages ? 'disabled' : '';
    controlsHtml += `
        <button class="pagination-btn" id="btnPageNext" ${nextDisabled} title="Próxima página" aria-label="Próxima página">
            <span>Próxima</span>
            <i class="fa-solid fa-chevron-right"></i>
        </button>
    `;

    controlsHtml += '</div>';

    paginationContainer.innerHTML = infoHtml + controlsHtml;

    const btnPrev = paginationContainer.querySelector('#btnPagePrev');
    if (btnPrev && !prevDisabled) {
        btnPrev.addEventListener('click', () => goToPage(state.currentPage - 1));
    }

    const btnNext = paginationContainer.querySelector('#btnPageNext');
    if (btnNext && !nextDisabled) {
        btnNext.addEventListener('click', () => goToPage(state.currentPage + 1));
    }

    paginationContainer.querySelectorAll('.pagination-num[data-page]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetPage = parseInt(e.currentTarget.getAttribute('data-page'), 10);
            if (targetPage && targetPage !== state.currentPage) {
                goToPage(targetPage);
            }
        });
    });
}

function getPaginationPageNumbers(currentPage, totalPages) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = [];
    if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
    } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
    }
    return pages;
}

function goToPage(page) {
    state.currentPage = page;
    renderResults();
    const target = document.querySelector('.results-toolbar') || document.querySelector('.results-section');
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function highlightText(text, searchStr) {
    if (!searchStr || !searchStr.trim()) return escapeHtml(text);
    const tokens = searchStr.trim().split(/\s+/).filter(t => t.length > 0);
    if (!tokens.length) return escapeHtml(text);

    const escapedTokens = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedTokens.join('|')})`, 'gi');
    return escapeHtml(text).replace(regex, '<span class="highlight-term">$1</span>');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Render Cards View (Visual idêntico ao layout padrão, com ícone de pasta/PDF e suporte a múltiplos documentos ou arquivo único)
function renderCardsView(documents = state.filteredDocuments) {
    if (!documentsCardsContainer) return;
    documentsCardsContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();

    documents.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'doc-card';

        const isOficio = doc.doc_type === 'oficio';
        const typeBadge = isOficio 
            ? `<span class="doc-badge type-oficio"><i class="fa-solid fa-file-pdf"></i> Ofício</span>` 
            : `<span class="doc-badge type-protocolo"><i class="fa-solid fa-folder-tree"></i> Protocolo</span>`;

        const highlightedTitle = highlightText(doc.name, state.searchTerm);
        const statusSlug = doc.status ? normalizeText(doc.status).replace(/\s+/g, '-') : '';
        const statusBadge = doc.status 
            ? `<span class="doc-badge status-${statusSlug}">${escapeHtml(doc.status)}</span>` 
            : '';

        const matchedHintHtml = doc.matched_file_name 
            ? `<div class="doc-matched-file-hint" title="Contém este documento"><i class="fa-solid fa-file-pdf"></i> Arquivo: <strong>${highlightText(doc.matched_file_name, state.searchTerm)}</strong></div>`
            : '';

        card.innerHTML = `
            <div>
                <div class="doc-card-header">
                    <div class="doc-icon-wrapper ${isOficio ? 'is-oficio' : 'is-folder'}" title="${isOficio ? 'Documento de Ofício' : 'Pasta de Protocolo'}">
                        <i class="fa-solid ${isOficio ? 'fa-file-pdf' : 'fa-folder'}"></i>
                    </div>
                    <div class="doc-card-title-group">
                        <div class="doc-badges">
                            ${typeBadge}
                            ${doc.year ? `<span class="doc-badge year">${doc.year}</span>` : ''}
                            <span class="doc-badge category">${escapeHtml(doc.category)}</span>
                            ${statusBadge}
                            ${!isOficio ? `
                            <span class="doc-badge file-count" title="${doc.total_files} documentos no protocolo">
                                <i class="fa-regular fa-file-lines"></i> ${doc.total_files} doc${doc.total_files !== 1 ? 's' : ''}
                            </span>` : ''}
                        </div>
                        <h4 class="doc-title" title="${escapeHtml(doc.name)}">${highlightedTitle}</h4>
                        ${matchedHintHtml}
                    </div>
                </div>

                <div class="doc-metadata-panel">
                    <div class="meta-item">
                        <span class="meta-label"><i class="fa-regular fa-calendar-days"></i> Data</span>
                        <span class="meta-value">${doc.doc_date_formatted || doc.mtime_formatted}</span>
                    </div>
                    <div class="meta-item full-width">
                        <span class="meta-label"><i class="fa-solid fa-hard-drive"></i> Tamanho</span>
                        <span class="meta-value">${isOficio ? doc.size_formatted : `${doc.total_files} arquivo${doc.total_files !== 1 ? 's' : ''} &bull; ${doc.size_formatted}`}</span>
                    </div>
                </div>
            </div>

            <div class="doc-card-actions">
                <button class="btn-card-action btn-preview" title="${isOficio ? 'Visualizar arquivo PDF' : 'Abrir e selecionar arquivos do protocolo'}">
                    <i class="fa-regular fa-eye"></i>
                    <span>Ver</span>
                </button>
                <button class="btn-card-action btn-download" title="${isOficio ? 'Baixar arquivo PDF' : 'Baixar todos os arquivos da pasta em ZIP'}">
                    <i class="fa-solid fa-download"></i>
                    <span>Baixar</span>
                </button>
                <button class="btn-card-action btn-delete" title="${isOficio ? 'Excluir ofício permanentemente' : 'Excluir pasta do protocolo permanentemente'}">
                    <i class="fa-regular fa-trash-can"></i>
                    <span>Excluir</span>
                </button>
            </div>
        `;

        // Event listeners
        const btnPreview = card.querySelector('.btn-preview');
        const docTitle = card.querySelector('.doc-title');
        const iconWrapper = card.querySelector('.doc-icon-wrapper');
        const btnDownload = card.querySelector('.btn-download');
        const btnDelete = card.querySelector('.btn-delete');

        if (btnPreview) btnPreview.addEventListener('click', () => openPreviewModal(doc));
        if (docTitle) docTitle.addEventListener('click', () => openPreviewModal(doc));
        if (iconWrapper) iconWrapper.addEventListener('click', () => openPreviewModal(doc));
        if (btnDownload) {
            btnDownload.addEventListener('click', () => {
                if (isOficio) {
                    downloadDocument(doc);
                } else {
                    downloadProtocolZip(doc);
                }
            });
        }
        if (btnDelete) btnDelete.addEventListener('click', () => openDeleteModal(doc));

        fragment.appendChild(card);
    });

    documentsCardsContainer.appendChild(fragment);
}

// Render Table View
function renderTableView(documents = state.filteredDocuments) {
    if (!documentsTableBody) return;
    documentsTableBody.innerHTML = '';
    const fragment = document.createDocumentFragment();

    documents.forEach(doc => {
        const tr = document.createElement('tr');
        const isOficio = doc.doc_type === 'oficio';
        const typeBadge = isOficio 
            ? `<span class="doc-badge type-oficio" style="font-size: 0.65rem;"><i class="fa-solid fa-file-pdf"></i> Ofício</span>` 
            : `<span class="doc-badge type-protocolo" style="font-size: 0.65rem;"><i class="fa-solid fa-folder-tree"></i> Protocolo</span>`;

        const highlightedTitle = highlightText(doc.name, state.searchTerm);
        const statusSlug = doc.status ? normalizeText(doc.status).replace(/\s+/g, '-') : '';
        const statusBadge = doc.status 
            ? `<span class="doc-badge status-${statusSlug}" style="font-size: 0.65rem;">${escapeHtml(doc.status)}</span>` 
            : '';

        const matchedHintHtml = doc.matched_file_name 
            ? `<div class="doc-matched-file-hint" style="margin-top: 4px; font-size: 0.72rem;"><i class="fa-solid fa-file-pdf"></i> ${highlightText(doc.matched_file_name, state.searchTerm)}</div>`
            : '';

        tr.innerHTML = `
            <td>
                <div class="table-doc-title-cell">
                    <div class="doc-icon-wrapper ${isOficio ? 'is-oficio' : 'is-folder'}" style="width: 36px; height: 36px; font-size: 1.1rem; flex-shrink: 0; cursor: pointer;" title="${isOficio ? 'Documento de Ofício' : 'Pasta de Protocolo'}">
                        <i class="fa-solid ${isOficio ? 'fa-file-pdf' : 'fa-folder'}"></i>
                    </div>
                    <div>
                        <span class="table-doc-title" title="${escapeHtml(doc.name)}" style="cursor: pointer; font-weight: 600;">${highlightedTitle}</span>
                        <div class="doc-badges" style="margin-top: 4px;">
                            ${typeBadge}
                            ${doc.year ? `<span class="doc-badge year" style="font-size: 0.65rem;">${doc.year}</span>` : ''}
                            <span class="doc-badge category" style="font-size: 0.65rem;">${escapeHtml(doc.category)}</span>
                            ${statusBadge}
                        </div>
                        ${matchedHintHtml}
                    </div>
                </div>
            </td>
            <td>
                <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">
                    ${escapeHtml(doc.assunto || doc.name)}
                </div>
            </td>
            <td>
                ${isOficio ? `
                <span class="doc-badge file-count" style="font-size: 0.75rem; background: var(--bg-surface-secondary); color: var(--text-secondary); border-color: var(--border-subtle);">
                    <i class="fa-solid fa-file-pdf" style="color: #ef4444;"></i> 1 arquivo
                </span>` : `
                <span class="doc-badge file-count" style="font-size: 0.75rem;">
                    <i class="fa-regular fa-file-lines"></i> ${doc.total_files} docs
                </span>`}
                <div style="font-size: 0.72rem; color: var(--text-tertiary); margin-top: 2px;">
                    ${doc.size_formatted}
                </div>
            </td>
            <td style="white-space: nowrap;">
                <strong style="font-size: 0.85rem;"><i class="fa-regular fa-calendar-days" style="color: var(--primary); margin-right: 5px; font-size: 0.78rem;"></i>${doc.doc_date_formatted || doc.mtime_formatted}</strong>
            </td>
            <td>
                <div class="table-actions">
                    <button class="btn-table-action primary btn-table-preview" title="${isOficio ? 'Visualizar arquivo PDF' : 'Visualizar arquivos do protocolo'}">
                        <i class="fa-regular fa-eye"></i>
                    </button>
                    <button class="btn-table-action btn-table-download" title="${isOficio ? 'Baixar arquivo PDF' : 'Baixar todos os arquivos (ZIP)'}">
                        <i class="fa-solid fa-download"></i>
                    </button>
                    <button class="btn-table-action btn-table-delete" title="${isOficio ? 'Excluir ofício' : 'Excluir pasta do protocolo'}">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;

        tr.querySelector('.btn-table-preview').addEventListener('click', () => openPreviewModal(doc));
        tr.querySelector('.table-doc-title').addEventListener('click', () => openPreviewModal(doc));
        tr.querySelector('.doc-icon-wrapper').addEventListener('click', () => openPreviewModal(doc));
        tr.querySelector('.btn-table-download').addEventListener('click', () => {
            if (isOficio) {
                downloadDocument(doc);
            } else {
                downloadProtocolZip(doc);
            }
        });
        tr.querySelector('.btn-table-delete').addEventListener('click', () => openDeleteModal(doc));

        fragment.appendChild(tr);
    });

    documentsTableBody.appendChild(fragment);
}

// ==========================================================================
// Protocol & Document Explorer Modal Handling
// ==========================================================================
function openPreviewModal(doc) {
    state.activeModalDoc = doc;
    state.activeModalFile = null;

    const modalContainer = previewModal ? previewModal.querySelector('.protocol-modal-container') : null;
    const isOficio = doc.doc_type === 'oficio';

    if (modalContainer) {
        if (isOficio) {
            modalContainer.classList.add('is-single-file');
        } else {
            modalContainer.classList.remove('is-single-file');
        }
    }

    if (modalDocTitle) {
        modalDocTitle.textContent = doc.name;
        modalDocTitle.title = doc.name;
    }

    if (btnModalDownloadZip) {
        if (isOficio) {
            btnModalDownloadZip.innerHTML = '<i class="fa-solid fa-download"></i> <span>Baixar PDF</span>';
            btnModalDownloadZip.title = 'Baixar arquivo PDF';
        } else {
            btnModalDownloadZip.innerHTML = '<i class="fa-solid fa-file-zipper"></i> <span>Baixar ZIP</span>';
            btnModalDownloadZip.title = 'Baixar todos os arquivos da pasta em ZIP';
        }
    }

    if (modalDocMeta) {
        const typeBadge = isOficio 
            ? `<span class="doc-badge type-oficio"><i class="fa-solid fa-file-pdf"></i> Ofício</span>` 
            : `<span class="doc-badge type-protocolo"><i class="fa-solid fa-folder-tree"></i> Protocolo</span>`;

        const statusSlug = doc.status ? normalizeText(doc.status).replace(/\s+/g, '-') : '';
        const statusBadge = doc.status 
            ? `<span class="doc-badge status-${statusSlug}">${escapeHtml(doc.status)}</span>` 
            : '';

        modalDocMeta.innerHTML = `
            ${typeBadge}
            ${doc.doc_date_formatted ? `<span class="doc-badge date" style="background: rgba(14, 165, 233, 0.12); color: #0284c7; border: 1px solid rgba(14, 165, 233, 0.3); font-weight: 600;"><i class="fa-regular fa-calendar-days"></i> ${doc.doc_date_formatted}</span>` : ''}
            ${doc.year ? `<span class="doc-badge year">${doc.year}</span>` : ''}
            <span class="doc-badge category">${escapeHtml(doc.category)}</span>
            ${statusBadge}
            ${!isOficio ? `
            <span class="doc-badge file-count">
                <i class="fa-regular fa-file-lines"></i> ${doc.total_files} arquivo${doc.total_files !== 1 ? 's' : ''}
            </span>` : ''}
            <span style="font-size: 0.8rem; color: var(--text-tertiary);">
                <i class="fa-solid fa-hard-drive"></i> ${doc.size_formatted}
            </span>
        `;
    }

    // Reset files search
    if (protocolFilesSearchInput) {
        protocolFilesSearchInput.value = '';
    }
    if (btnClearProtocolFilesSearch) {
        btnClearProtocolFilesSearch.classList.add('hidden');
    }

    // Populate inner file list
    const files = Array.isArray(doc.files) ? doc.files : [];
    renderProtocolFilesList(files);

    // Ensure mobile starts on the file list for multi-file protocols
    if (protocolPreviewPanel) {
        if (isOficio) {
            protocolPreviewPanel.classList.add('mobile-visible');
        } else {
            protocolPreviewPanel.classList.remove('mobile-visible');
        }
    }

    // Auto-select document: matched file or first file or direct doc
    let targetFile = null;
    if (doc.matched_file_name) {
        targetFile = files.find(f => f.name === doc.matched_file_name);
    }
    if (!targetFile && files.length > 0) {
        targetFile = files[0];
    }
    if (!targetFile && isOficio) {
        targetFile = doc;
    }

    if (targetFile) {
        // Only slide to preview on mobile if it is a single oficio! For protocols, user starts on file list.
        selectProtocolFile(targetFile, isOficio);
    } else {
        // Empty protocol folder
        if (activeDocName) activeDocName.textContent = 'Nenhum documento encontrado';
        if (activeDocMeta) activeDocMeta.textContent = '--';
        if (pdfViewerFrame) {
            pdfViewerFrame.classList.add('hidden');
            pdfViewerFrame.src = '';
        }
        if (emptyFileSelectedState) emptyFileSelectedState.classList.remove('hidden');
    }

    if (previewModal) previewModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// Render list of files inside the protocol
function renderProtocolFilesList(files) {
    if (!protocolFilesList) return;
    protocolFilesList.innerHTML = '';

    if (protocolFilesCount) {
        protocolFilesCount.textContent = `${files.length} documento${files.length !== 1 ? 's' : ''} no protocolo`;
    }

    if (!files.length) {
        protocolFilesList.innerHTML = `
            <li class="protocol-files-empty">
                <i class="fa-solid fa-folder-open"></i>
                <p>Nenhum arquivo nesta pasta de protocolo.</p>
            </li>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    files.forEach((file, index) => {
        const li = document.createElement('li');
        li.className = 'protocol-file-item';
        li.dataset.path = file.relative_path;
        li.dataset.name = file.name;

        li.innerHTML = `
            <span class="file-num-pill">${index + 1}</span>
            <div class="file-item-icon">
                <i class="fa-solid fa-file-pdf"></i>
            </div>
            <div class="file-item-info">
                <span class="file-item-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                <span class="file-item-meta">${file.size_formatted} &bull; ${file.mtime_formatted || ''}</span>
            </div>
            <div class="file-item-actions">
                <button class="btn-file-quick-download" title="Baixar este arquivo" aria-label="Baixar ${escapeHtml(file.name)}">
                    <i class="fa-solid fa-download"></i>
                </button>
                <div class="file-item-chevron">
                    <i class="fa-solid fa-chevron-right"></i>
                </div>
            </div>
        `;

        li.addEventListener('click', (e) => {
            if (e.target.closest('.btn-file-quick-download')) return;
            selectProtocolFile(file, true);
        });

        const btnQuick = li.querySelector('.btn-file-quick-download');
        if (btnQuick) {
            btnQuick.addEventListener('click', (e) => {
                e.stopPropagation();
                downloadDocument(file);
            });
        }

        fragment.appendChild(li);
    });

    protocolFilesList.appendChild(fragment);
}

// Select and preview a specific file from the protocol
function selectProtocolFile(file, autoSlideMobile = true) {
    if (!file) return;
    state.activeModalFile = file;

    // Highlight active item in list
    if (protocolFilesList) {
        const allItems = protocolFilesList.querySelectorAll('.protocol-file-item');
        allItems.forEach(item => {
            item.classList.toggle('active', item.dataset.path === file.relative_path);
        });
    }

    // Update viewer toolbar
    if (activeDocName) {
        activeDocName.textContent = file.name;
        activeDocName.title = file.name;
    }
    if (activeDocMeta) {
        activeDocMeta.textContent = `${file.size_formatted} • Modificado em ${file.mtime_formatted || ''} • PDF`;
    }

    // Update back button text with file count
    if (btnBackToFilesList) {
        const totalFiles = (state.activeModalDoc && state.activeModalDoc.files) ? state.activeModalDoc.files.length : '';
        btnBackToFilesList.innerHTML = `<i class="fa-solid fa-arrow-left"></i> <span>Voltar à Lista (${totalFiles})</span>`;
    }

    const pathParts = (file.relative_path || file.name).split('/').map(encodeURIComponent).join('/');
    const previewUrl = `/api/pdf/preview/${pathParts}`;

    if (btnActiveDocNewTab) btnActiveDocNewTab.href = previewUrl;
    if (btnMobileOpenPdf) btnMobileOpenPdf.href = previewUrl;

    if (emptyFileSelectedState) emptyFileSelectedState.classList.add('hidden');
    if (modalLoading) modalLoading.classList.remove('hidden');

    if (pdfViewerFrame) {
        pdfViewerFrame.classList.remove('hidden');
        pdfViewerFrame.src = previewUrl;
    }

    // Mobile slide to preview pane only when requested
    if (autoSlideMobile && window.innerWidth <= 868 && protocolPreviewPanel) {
        protocolPreviewPanel.classList.add('mobile-visible');
    }
}

// Filter the protocol files inside the modal
function filterProtocolFilesList(term) {
    if (!protocolFilesList) return;
    const items = protocolFilesList.querySelectorAll('.protocol-file-item');
    let visibleCount = 0;

    items.forEach(item => {
        const name = normalizeText(item.dataset.name || '');
        const matches = !term || name.includes(term);
        item.style.display = matches ? '' : 'none';
        if (matches) visibleCount++;
    });

    if (protocolFilesCount) {
        if (!term) {
            protocolFilesCount.textContent = `${items.length} documento${items.length !== 1 ? 's' : ''} no protocolo`;
        } else {
            protocolFilesCount.textContent = `${visibleCount} de ${items.length} documento${items.length !== 1 ? 's' : ''}`;
        }
    }
}

function closeModal() {
    if (previewModal) {
        previewModal.classList.add('hidden');
        const modalContainer = previewModal.querySelector('.protocol-modal-container');
        if (modalContainer) {
            modalContainer.classList.remove('is-single-file');
        }
    }
    if (pdfViewerFrame) pdfViewerFrame.src = '';
    if (protocolPreviewPanel) protocolPreviewPanel.classList.remove('mobile-visible');
    state.activeModalDoc = null;
    state.activeModalFile = null;
    document.body.style.overflow = '';
}

// ==========================================================================
// Delete Confirmation Modal Handling
// ==========================================================================
function openDeleteModal(doc) {
    state.docToDelete = doc;
    if (deleteDocName) deleteDocName.textContent = `"${doc.name}"`;
    if (deleteModal) {
        deleteModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeDeleteModal() {
    state.docToDelete = null;
    if (deleteModal) {
        deleteModal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

async function confirmDelete() {
    const doc = state.docToDelete;
    if (!doc) return;

    const originalHtml = btnConfirmDelete.innerHTML;
    btnConfirmDelete.disabled = true;
    btnConfirmDelete.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Excluindo...</span>';

    try {
        const token = localStorage.getItem('pmo_github_token') || '';
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['X-GitHub-Token'] = token;

        const response = await fetch('/api/protocolo/delete', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ relative_path: doc.relative_path })
        });
        const data = await response.json();

        if (data.success) {
            state.allDocuments = state.allDocuments.filter(d => d.relative_path !== doc.relative_path && d.name !== doc.name);
            updateModuleTabCounts();
            applyFiltersAndRender();
            closeDeleteModal();
            if (state.activeModalDoc && state.activeModalDoc.relative_path === doc.relative_path) {
                closeModal();
            }
            const isOficio = doc.doc_type === 'oficio';
            showToast(data.message || `${isOficio ? 'Ofício' : 'Protocolo'} removido com sucesso!`, 'success');
        } else {
            if (data.error === 'github_token_required') {
                showToast(data.message, 'error');
                closeDeleteModal();
                openImportModal();
                if (importNoticeAlert && importNoticeMessage) {
                    importNoticeMessage.innerHTML = 'Para excluir protocolos permanentemente no Vercel, informe o <strong>GitHub Personal Access Token</strong> nas configurações abaixo ou adicione a variável <code>GITHUB_TOKEN</code> no painel da Vercel.';
                    importNoticeAlert.classList.remove('hidden');
                }
                toggleGithubSettings(true);
            } else {
                showToast(data.error || 'Erro ao excluir protocolo', 'error');
            }
        }
    } catch (err) {
        console.error('Erro ao excluir:', err);
        showToast('Erro de conexão ao excluir protocolo', 'error');
    } finally {
        btnConfirmDelete.disabled = false;
        btnConfirmDelete.innerHTML = originalHtml;
    }
}

// ==========================================================================
// Import Modal Handling & File Upload
// ==========================================================================
function openImportModal() {
    if (importModal) {
        // Sync destination with current active tab
        currentImportDestination = state.activeMainTab === 'oficios' ? 'oficios' : 'protocolos';
        destTabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.destination === currentImportDestination);
        });

        // Populate datalist with existing protocol names for auto-complete
        if (existingProtocolosDatalist) {
            existingProtocolosDatalist.innerHTML = '';
            const protNames = state.allDocuments
                .filter(d => d.doc_type === 'protocolo')
                .map(d => d.name)
                .filter((v, i, a) => a.indexOf(v) === i)
                .sort();
            protNames.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                existingProtocolosDatalist.appendChild(opt);
            });
        }

        if (protocolFolderNameInput) {
            protocolFolderNameInput.value = '';
        }

        updateImportDestinationUI();

        importModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        checkSystemStatus();
    }
}

function updateImportDestinationUI() {
    const isProt = currentImportDestination === 'protocolos';
    const isFolder = currentImportMode === 'folder';

    if (protocolDestinationInputGroup) {
        // Show folder name input only if destination is Protocolos and mode is individual files
        protocolDestinationInputGroup.classList.toggle('hidden', !isProt || isFolder);
    }

    if (importModalTitle) {
        importModalTitle.textContent = isProt ? 'Importar Protocolos' : 'Importar Ofícios';
    }

    if (dropZoneTitle) {
        if (isProt) {
            dropZoneTitle.textContent = isFolder 
                ? 'Arraste uma pasta de protocolo aqui ou clique para procurar' 
                : 'Arraste os PDFs do protocolo aqui ou clique para selecionar';
        } else {
            dropZoneTitle.textContent = isFolder 
                ? 'Arraste a pasta com ofícios aqui ou clique para procurar' 
                : 'Arraste seus PDFs de Ofício aqui ou clique para selecionar';
        }
    }

    if (dropZoneDesc) {
        if (isProt) {
            dropZoneDesc.textContent = isFolder 
                ? 'A pasta completa será importada como um novo protocolo (o nome da pasta será o protocolo)' 
                : 'Os arquivos serão salvos na pasta de protocolo indicada acima';
        } else {
            dropZoneDesc.textContent = isFolder 
                ? 'Todos os arquivos PDF da pasta serão indexados na pasta de Ofícios' 
                : 'Você pode selecionar vários arquivos de uma só vez (PDF)';
        }
    }

    if (btnBrowseFiles) {
        btnBrowseFiles.innerHTML = isFolder 
            ? '<i class="fa-solid fa-folder-tree"></i> Selecionar Pasta' 
            : '<i class="fa-solid fa-folder-open"></i> Selecionar Arquivos';
    }

    renderImportFileList();
}

function closeImportModal() {
    if (importModal) {
        importModal.classList.add('hidden');
        document.body.style.overflow = '';
        clearImportSelection();
    }
}

function clearImportSelection() {
    selectedImportFiles = [];
    renderImportFileList();
    if (fileInputMultiple) fileInputMultiple.value = '';
    if (fileInputFolder) fileInputFolder.value = '';
    if (importProgressBarContainer) importProgressBarContainer.classList.add('hidden');
}

function handleFilesSelected(fileList) {
    const newFiles = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (!newFiles.length) {
        showToast('Nenhum arquivo PDF encontrado na seleção.', 'error');
        return;
    }

    newFiles.forEach(nf => {
        if (!selectedImportFiles.some(f => f.name === nf.name)) {
            selectedImportFiles.push(nf);
        }
    });

    renderImportFileList();
}

function renderImportFileList() {
    if (!selectedImportFiles.length) {
        if (importFileListContainer) importFileListContainer.classList.add('hidden');
        if (btnStartImport) {
            btnStartImport.disabled = true;
            btnStartImport.innerHTML = '<i class="fa-solid fa-upload"></i> <span>Iniciar Importação</span>';
        }
        return;
    }

    if (importFileListContainer) importFileListContainer.classList.remove('hidden');
    if (importFileCount) importFileCount.textContent = `${selectedImportFiles.length} arquivo(s) selecionado(s)`;
    if (btnStartImport) {
        btnStartImport.disabled = false;
        const targetLabel = currentImportDestination === 'oficios' ? 'Ofício(s)' : 'Documento(s) para Protocolo';
        btnStartImport.innerHTML = `<i class="fa-solid fa-upload"></i> <span>Importar ${selectedImportFiles.length} ${targetLabel}</span>`;
    }

    if (importFileList) {
        importFileList.innerHTML = '';
        selectedImportFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'import-file-item';
            const sizeStr = file.size < 1024 * 1024 
                ? (file.size / 1024).toFixed(1) + ' KB' 
                : (file.size / (1024 * 1024)).toFixed(2) + ' MB';
            item.innerHTML = `
                <div class="import-file-name">
                    <i class="fa-solid fa-file-pdf" style="color: #ef4444;"></i>
                    <span title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                    <span class="import-file-size">(${sizeStr})</span>
                </div>
                <button type="button" class="btn-remove-import-file" title="Remover"><i class="fa-solid fa-xmark"></i></button>
            `;
            item.querySelector('.btn-remove-import-file').addEventListener('click', (e) => {
                e.stopPropagation();
                selectedImportFiles.splice(index, 1);
                renderImportFileList();
            });
            importFileList.appendChild(item);
        });
    }
}

async function startImportUpload() {
    if (!selectedImportFiles.length) return;

    btnStartImport.disabled = true;
    if (importProgressBarContainer) importProgressBarContainer.classList.remove('hidden');
    if (importNoticeAlert) importNoticeAlert.classList.add('hidden');

    const totalFiles = selectedImportFiles.length;
    let successCount = 0;
    const errors = [];
    const token = localStorage.getItem('pmo_github_token') || '';
    const destination = currentImportDestination;
    let baseProtocolFolder = '';
    if (destination === 'protocolos' && protocolFolderNameInput && protocolFolderNameInput.value.trim()) {
        baseProtocolFolder = protocolFolderNameInput.value.trim();
    }

    for (let i = 0; i < totalFiles; i++) {
        const file = selectedImportFiles[i];
        const percent = Math.round(((i + 1) / totalFiles) * 100);
        if (importProgressFill) importProgressFill.style.width = `${Math.max(10, percent)}%`;
        if (importProgressLabel) importProgressLabel.textContent = `Enviando arquivo ${i + 1} de ${totalFiles}: ${file.name}...`;

        let fileProtFolder = baseProtocolFolder;
        if (!fileProtFolder && file.webkitRelativePath) {
            const parts = file.webkitRelativePath.split('/');
            if (parts.length > 1 && parts[0]) {
                fileProtFolder = parts[0];
            }
        }
        if (!fileProtFolder && destination === 'protocolos') {
            fileProtFolder = file.name.replace(/\.[^/.]+$/, "");
        }

        const MAX_VERCEL_BYTES = 4.3 * 1024 * 1024;

        try {
            // If file is > 4.3 MB and token is present on browser, commit directly to GitHub via REST API
            if (token && file.size > MAX_VERCEL_BYTES) {
                const arrayBuffer = await file.arrayBuffer();
                let binary = '';
                const bytes = new Uint8Array(arrayBuffer);
                const len = bytes.byteLength;
                for (let b = 0; b < len; b++) {
                    binary += String.fromCharCode(bytes[b]);
                }
                const base64Content = btoa(binary);

                const repoPath = destination === 'oficios'
                    ? `01 - Relatórios/01 - Consulta de Ofícios/Base de dados Ofícios/Ofícios/${file.name}`
                    : `01 - Relatórios/01 - Consulta de Ofícios/Base de dados Ofícios/Protocolos/${fileProtFolder}/${file.name}`;
                const ghUrl = `https://api.github.com/repos/alisonpersil/hub-barretosinteligente/contents/${encodeURIComponent(repoPath)}`;

                let sha = null;
                try {
                    const checkRes = await fetch(ghUrl, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });
                    if (checkRes.ok) {
                        const checkData = await checkRes.json();
                        sha = checkData.sha;
                    }
                } catch (_) {}

                const ghBody = {
                    message: `feat: importar ${destination === 'oficios' ? 'oficio' : 'protocolo'} ${file.name}`,
                    content: base64Content
                };
                if (sha) ghBody.sha = sha;

                const ghRes = await fetch(ghUrl, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(ghBody)
                });

                if (!ghRes.ok) {
                    const ghErr = await ghRes.json().catch(() => ({}));
                    throw new Error(ghErr.message || `Erro GitHub (${ghRes.status})`);
                }

                successCount++;
            } else if (file.size > MAX_VERCEL_BYTES && !token) {
                errors.push(`${file.name}: Arquivo possui ${(file.size / (1024 * 1024)).toFixed(2)} MB (limite na Vercel é de 4.5 MB por arquivo). Configure o GitHub Token para upload direto ou comprima o PDF.`);
            } else {
                // Send to /api/oficios/upload
                const singleFormData = new FormData();
                singleFormData.append('files', file);
                singleFormData.append('destination', destination);
                if (fileProtFolder) {
                    singleFormData.append('protocol_name', fileProtFolder);
                }
                if (file.webkitRelativePath) {
                    singleFormData.append('webkit_relative_path', file.webkitRelativePath);
                }

                const headers = {};
                if (token) headers['X-GitHub-Token'] = token;

                const response = await fetch('/api/oficios/upload', {
                    method: 'POST',
                    headers: headers,
                    body: singleFormData
                });

                if (!response.ok) {
                    if (response.status === 413) {
                        throw new Error(`Arquivo muito grande para envio na Vercel (limite 4.5 MB). Reduza o PDF ou configure o GitHub Token.`);
                    }
                    const text = await response.text();
                    let errMsg = `Erro HTTP ${response.status}`;
                    try {
                        const parsed = JSON.parse(text);
                        if (parsed.message) errMsg = parsed.message;
                        else if (parsed.error) errMsg = parsed.error;
                    } catch (_) {
                        if (text && text.length < 120) errMsg = text;
                    }
                    throw new Error(errMsg);
                }

                const data = await response.json();
                if (data.success) {
                    successCount += (data.count || 1);
                } else if (data.error === 'github_token_required') {
                    showToast(data.message, 'error');
                    if (importNoticeAlert && importNoticeMessage) {
                        importNoticeMessage.innerHTML = 'Para que os documentos sejam salvos permanentemente no Vercel, informe o <strong>GitHub Personal Access Token</strong> nas configurações abaixo ou adicione a variável <code>GITHUB_TOKEN</code> no painel da Vercel.';
                        importNoticeAlert.classList.remove('hidden');
                    }
                    toggleGithubSettings(true);
                    btnStartImport.disabled = false;
                    return;
                } else {
                    throw new Error(data.message || data.error || 'Falha ao salvar no servidor');
                }
            }
        } catch (err) {
            console.error(`Erro no upload de ${file.name}:`, err);
            errors.push(`${file.name}: ${err.message || 'Erro de conexão'}`);
        }
    }

    if (importProgressFill) importProgressFill.style.width = '100%';

    if (successCount > 0) {
        await loadDocuments(true);
        state.activeMainTab = destination;
        moduleTabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mainTab === destination);
        });
        applyFiltersAndRender(true);
    }

    if (errors.length === 0) {
        if (importProgressLabel) importProgressLabel.textContent = 'Upload concluído com sucesso!';
        setTimeout(() => {
            closeImportModal();
            const destName = destination === 'oficios' ? 'Ofícios' : 'Protocolos';
            showToast(`${successCount} documento(s) importado(s) com sucesso em ${destName}!`, 'success');
        }, 600);
    } else {
        if (importProgressLabel) importProgressLabel.textContent = `Concluído: ${successCount} salvos, ${errors.length} com erro.`;
        if (importNoticeAlert && importNoticeMessage) {
            importNoticeMessage.innerHTML = `<strong>Atenção:</strong><br>${errors.join('<br>')}`;
            importNoticeAlert.classList.remove('hidden');
        }
        showToast(successCount > 0 ? `${successCount} arquivo(s) importado(s), mas alguns falharam.` : 'Falha ao importar arquivos.', 'warning');
        btnStartImport.disabled = false;
    }
}

function toggleGithubSettings(forceOpen) {
    if (!githubSettingsBody || !githubSettingsChevron) return;
    const shouldOpen = forceOpen !== undefined ? forceOpen : githubSettingsBody.classList.contains('hidden');
    if (shouldOpen) {
        githubSettingsBody.classList.remove('hidden');
        githubSettingsChevron.classList.add('open');
    } else {
        githubSettingsBody.classList.add('hidden');
        githubSettingsChevron.classList.remove('open');
    }
}

async function checkSystemStatus() {
    try {
        const res = await fetch('/api/system/status');
        if (res.ok) {
            const data = await res.json();
            const savedToken = localStorage.getItem('pmo_github_token') || '';
            if (githubTokenInput && savedToken) {
                githubTokenInput.value = savedToken;
            }
            if (data.has_github_token) {
                // Token is already configured in Vercel environment! Hide the GitHub card completely
                if (cloudSettingsCard) cloudSettingsCard.classList.add('hidden');
                if (importNoticeAlert) importNoticeAlert.classList.add('hidden');
            } else if (savedToken) {
                if (cloudSettingsCard) cloudSettingsCard.classList.add('hidden');
                if (importNoticeAlert) importNoticeAlert.classList.add('hidden');
            }
        }
    } catch (e) {
        console.warn('Status check failed:', e);
    }
}

// ==========================================================================
// UI Helpers & Utilities
// ==========================================================================
function clearSearch() {
    if (!searchInput) return;
    searchInput.value = '';
    state.searchTerm = '';
    toggleClearButton();
    applyFiltersAndRender();
    searchInput.focus();
}

function toggleClearButton() {
    if (!btnClearSearch || !searchInput) return;
    if (searchInput.value.length > 0) {
        btnClearSearch.classList.remove('hidden');
    } else {
        btnClearSearch.classList.add('hidden');
    }
}

function scrollToResults() {
    const toolbar = document.querySelector('.results-toolbar');
    if (toolbar) {
        toolbar.scrollIntoView({ behavior: 'smooth' });
    }
}

function setViewMode(mode) {
    state.currentView = mode;
    if (mode === 'cards') {
        if (btnViewCards) btnViewCards.classList.add('active');
        if (btnViewList) btnViewList.classList.remove('active');
    } else {
        if (btnViewList) btnViewList.classList.add('active');
        if (btnViewCards) btnViewCards.classList.remove('active');
    }
    renderResults();
}

// Theme handling (Default: Light/White com sincronização global)
function initTheme() {
    const savedTheme = localStorage.getItem('pmo_theme') || localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    window.addEventListener('storage', function(e) {
        if (e.key === 'pmo_theme' || e.key === 'theme') {
            if (e.newValue && (e.newValue === 'light' || e.newValue === 'dark')) {
                applyTheme(e.newValue);
            }
        }
    });
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
        localStorage.setItem('pmo_theme', theme);
        localStorage.setItem('theme', theme);
    } catch (_) {}
    updateThemeIcon(theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

function updateThemeIcon(theme) {
    if (!btnThemeToggle) return;
    const icon = btnThemeToggle.querySelector('i');
    if (icon) {
        if (theme === 'light') {
            icon.className = 'fa-solid fa-moon';
            btnThemeToggle.title = 'Alternar para modo escuro';
        } else {
            icon.className = 'fa-solid fa-sun';
            btnThemeToggle.title = 'Alternar para modo claro';
        }
    }
}

// Toast Notifications
function showToast(message, type = 'success') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconClass = 'fa-solid fa-circle-check';
    if (type === 'info') iconClass = 'fa-solid fa-circle-info';
    if (type === 'error') iconClass = 'fa-solid fa-triangle-exclamation';

    toast.innerHTML = `
        <div class="toast-icon"><i class="${iconClass}"></i></div>
        <div class="toast-message">${escapeHtml(message)}</div>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
