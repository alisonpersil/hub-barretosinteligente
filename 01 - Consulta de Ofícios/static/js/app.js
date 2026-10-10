/**
 * Sistema de Consulta de Ofícios - Frontend Logic
 * Estilo ChatGPT / OpenAI Interface com suporte a Importação e Exclusão
 */

// Application State
const state = {
    allDocuments: [],
    filteredDocuments: [],
    searchTerm: '',
    activeFilterChip: 'all',
    currentSort: 'mtime_desc',
    currentView: 'cards', // 'cards' | 'table'
    activeModalDoc: null,
    docToDelete: null
};

let selectedImportFiles = [];

// DOM Elements
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

const documentsCardsContainer = document.getElementById('documentsCardsContainer');
const documentsTableContainer = document.getElementById('documentsTableContainer');
const documentsTableBody = document.getElementById('documentsTableBody');
const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const btnClearSearchEmpty = document.getElementById('btnClearSearchEmpty');

const btnRefresh = document.getElementById('btnRefresh');
const btnThemeToggle = document.getElementById('btnThemeToggle');
const headerDocCount = document.getElementById('headerDocCount');

// Preview Modal Elements
const previewModal = document.getElementById('previewModal');
const modalDocTitle = document.getElementById('modalDocTitle');
const modalDocMeta = document.getElementById('modalDocMeta');
const pdfViewerFrame = document.getElementById('pdfViewerFrame');
const modalLoading = document.getElementById('modalLoading');
const btnModalClose = document.getElementById('btnModalClose');
const btnModalDownload = document.getElementById('btnModalDownload');
const btnModalNewTab = document.getElementById('btnModalNewTab');
const btnModalDelete = document.getElementById('btnModalDelete');
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
function initApp() {
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
            applyFiltersAndRender();
        });
    }

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
                    showToast('Lista de ofícios atualizada!', 'success');
                }, 400);
            });
        });
    }

    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', toggleTheme);
    }

    // Preview Modal Events
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

    if (btnModalDownload) {
        btnModalDownload.addEventListener('click', () => {
            if (state.activeModalDoc) downloadDocument(state.activeModalDoc);
        });
    }

    if (btnModalDelete) {
        btnModalDelete.addEventListener('click', () => {
            if (state.activeModalDoc) openDeleteModal(state.activeModalDoc);
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

    // Import Tabs Switcher (Files vs Folder)
    let currentImportMode = 'files';
    if (tabImportFiles && tabImportFolder) {
        tabImportFiles.addEventListener('click', () => {
            tabImportFiles.classList.add('active');
            tabImportFolder.classList.remove('active');
            currentImportMode = 'files';
            if (dropZoneTitle) dropZoneTitle.textContent = 'Arraste seus PDFs aqui ou clique para selecionar';
            if (dropZoneDesc) dropZoneDesc.textContent = 'Você pode selecionar vários arquivos de uma só vez (PDF)';
            if (btnBrowseFiles) btnBrowseFiles.innerHTML = '<i class="fa-solid fa-folder-open"></i> Selecionar Arquivos';
        });

        tabImportFolder.addEventListener('click', () => {
            tabImportFolder.classList.add('active');
            tabImportFiles.classList.remove('active');
            currentImportMode = 'folder';
            if (dropZoneTitle) dropZoneTitle.textContent = 'Arraste uma pasta inteira ou clique para procurar';
            if (dropZoneDesc) dropZoneDesc.textContent = 'Todos os arquivos PDF da pasta serão indexados';
            if (btnBrowseFiles) btnBrowseFiles.innerHTML = '<i class="fa-solid fa-folder-tree"></i> Selecionar Pasta';
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

// ==========================================================================
// Data Fetching & API
// ==========================================================================
async function loadDocuments(forceFetch = false) {
    if (!forceFetch && window.INITIAL_DOCS && Array.isArray(window.INITIAL_DOCS) && window.INITIAL_DOCS.length > 0) {
        state.allDocuments = window.INITIAL_DOCS;
        if (headerDocCount) headerDocCount.textContent = `${window.INITIAL_DOCS.length} documentos`;
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
            if (headerDocCount) headerDocCount.textContent = `${data.count} documentos`;
            applyFiltersAndRender();
        } else {
            showToast('Erro ao carregar lista de ofícios', 'error');
        }
    } catch (error) {
        console.error('Erro ao buscar documentos:', error);
        showToast('Não foi possível conectar ao servidor', 'error');
    } finally {
        if (loadingState) loadingState.classList.add('hidden');
    }
}

// Download file
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

function applyFiltersAndRender() {
    let result = [...state.allDocuments];
    const searchNormalized = normalizeText(state.searchTerm);
    const searchTokens = searchNormalized.split(/\s+/).filter(t => t.length > 0);

    // 1. Text Search Filter
    if (searchTokens.length > 0) {
        result = result.filter(doc => {
            const docNameNormalized = normalizeText(doc.name);
            const docCategoryNormalized = normalizeText(doc.category);
            return searchTokens.every(token => 
                docNameNormalized.includes(token) || 
                docCategoryNormalized.includes(token)
            );
        });
    }

    // 2. Chip Filter
    if (state.activeFilterChip && state.activeFilterChip !== 'all') {
        const filterKey = state.activeFilterChip;
        result = result.filter(doc => {
            const nameNorm = normalizeText(doc.name);
            const catNorm = normalizeText(doc.category);
            if (filterKey === '2024') return nameNorm.includes('2024') || doc.year === '2024';
            if (filterKey === '2023') return nameNorm.includes('2023') || doc.year === '2023';
            if (filterKey === 'videomonitoramento') return nameNorm.includes('videomonitoramento') || nameNorm.includes('camera') || nameNorm.includes('câmera');
            if (filterKey === 'garantia') return nameNorm.includes('garantia');
            if (filterKey === 'iluminacao') return nameNorm.includes('ilumina');
            if (filterKey === 'relatorio') return nameNorm.includes('relat') || catNorm.includes('relat');
            if (filterKey === 'anexo') return nameNorm.includes('anexo') || catNorm.includes('anexo');
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
                return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
            case 'name_desc':
                return b.name.localeCompare(a.name, 'pt-BR', { sensitivity: 'base' });
            case 'ctime_desc':
                return b.ctime - a.ctime;
            case 'ctime_asc':
                return a.ctime - b.ctime;
            case 'mtime_desc':
                return b.mtime - a.mtime;
            case 'mtime_asc':
                return a.mtime - b.mtime;
            case 'size_desc':
                return b.size_bytes - a.size_bytes;
            case 'size_asc':
                return a.size_bytes - b.size_bytes;
            default:
                return b.mtime - a.mtime;
        }
    });

    state.filteredDocuments = result;
    renderResults();
}

function getFilterLabel(filterKey) {
    const chip = document.querySelector(`.chip[data-filter="${filterKey}"]`);
    return chip ? chip.textContent.trim() : filterKey;
}

// ==========================================================================
// Rendering Results
// ==========================================================================
function renderResults() {
    const total = state.allDocuments.length;
    const count = state.filteredDocuments.length;

    if (resultsCounter) {
        resultsCounter.innerHTML = `Exibindo <strong>${count}</strong> de <strong>${total}</strong> ofícios`;
    }

    if (count === 0) {
        if (documentsCardsContainer) documentsCardsContainer.classList.add('hidden');
        if (documentsTableContainer) documentsTableContainer.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    if (state.currentView === 'cards') {
        renderCardsView();
        if (documentsCardsContainer) documentsCardsContainer.classList.remove('hidden');
        if (documentsTableContainer) documentsTableContainer.classList.add('hidden');
    } else {
        renderTableView();
        if (documentsTableContainer) documentsTableContainer.classList.remove('hidden');
        if (documentsCardsContainer) documentsCardsContainer.classList.add('hidden');
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

// Render Cards View
function renderCardsView() {
    if (!documentsCardsContainer) return;
    documentsCardsContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();

    state.filteredDocuments.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'doc-card';

        const fileIconClass = doc.is_pdf ? 'fa-solid fa-file-pdf' : 'fa-solid fa-file-lines';
        const highlightedTitle = highlightText(doc.name, state.searchTerm);

        card.innerHTML = `
            <div>
                <div class="doc-card-header">
                    <div class="doc-icon-wrapper">
                        <i class="${fileIconClass}"></i>
                    </div>
                    <div class="doc-card-title-group">
                        <div class="doc-badges">
                            ${doc.year ? `<span class="doc-badge year">${doc.year}</span>` : ''}
                            <span class="doc-badge category">${escapeHtml(doc.category)}</span>
                        </div>
                        <h4 class="doc-title" title="${escapeHtml(doc.name)}">${highlightedTitle}</h4>
                    </div>
                </div>

                <div class="doc-metadata-panel">
                    <div class="meta-item">
                        <span class="meta-label"><i class="fa-regular fa-clock"></i> Modificação</span>
                        <span class="meta-value">${doc.mtime_formatted}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label"><i class="fa-regular fa-calendar-plus"></i> Criação</span>
                        <span class="meta-value">${doc.ctime_formatted}</span>
                    </div>
                    <div class="meta-item full-width">
                        <span class="meta-label"><i class="fa-solid fa-hard-drive"></i> Tamanho</span>
                        <span class="meta-value">${doc.size_formatted}</span>
                    </div>
                </div>
            </div>

            <div class="doc-card-actions">
                <button class="btn-card-action btn-preview" title="Visualizar documento">
                    <i class="fa-regular fa-eye"></i>
                    <span>Ver</span>
                </button>
                <button class="btn-card-action btn-download" title="Baixar arquivo">
                    <i class="fa-solid fa-download"></i>
                    <span>Baixar</span>
                </button>
                <button class="btn-card-action btn-delete" title="Excluir documento permanentemente">
                    <i class="fa-regular fa-trash-can"></i>
                    <span>Excluir</span>
                </button>
            </div>
        `;

        card.querySelector('.btn-preview').addEventListener('click', () => openPreviewModal(doc));
        card.querySelector('.doc-title').addEventListener('click', () => openPreviewModal(doc));
        card.querySelector('.btn-download').addEventListener('click', () => downloadDocument(doc));
        card.querySelector('.btn-delete').addEventListener('click', () => openDeleteModal(doc));

        fragment.appendChild(card);
    });

    documentsCardsContainer.appendChild(fragment);
}

// Render Table View
function renderTableView() {
    if (!documentsTableBody) return;
    documentsTableBody.innerHTML = '';
    const fragment = document.createDocumentFragment();

    state.filteredDocuments.forEach(doc => {
        const tr = document.createElement('tr');
        const fileIconClass = doc.is_pdf ? 'fa-solid fa-file-pdf' : 'fa-solid fa-file-lines';
        const highlightedTitle = highlightText(doc.name, state.searchTerm);

        tr.innerHTML = `
            <td>
                <div class="table-doc-title-cell">
                    <i class="${fileIconClass} table-doc-icon"></i>
                    <div>
                        <span class="table-doc-title" title="${escapeHtml(doc.name)}">${highlightedTitle}</span>
                        <div class="doc-badges" style="margin-top: 3px;">
                            ${doc.year ? `<span class="doc-badge year" style="font-size: 0.65rem;">${doc.year}</span>` : ''}
                            <span class="doc-badge category" style="font-size: 0.65rem;">${escapeHtml(doc.category)}</span>
                        </div>
                    </div>
                </div>
            </td>
            <td><strong>${doc.mtime_formatted}</strong></td>
            <td>${doc.ctime_formatted}</td>
            <td>${doc.size_formatted}</td>
            <td>
                <div class="table-actions">
                    <button class="btn-table-action primary btn-table-preview" title="Visualizar documento">
                        <i class="fa-regular fa-eye"></i>
                    </button>
                    <button class="btn-table-action btn-table-download" title="Baixar arquivo">
                        <i class="fa-solid fa-download"></i>
                    </button>
                    <button class="btn-table-action btn-table-delete" title="Excluir arquivo">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;

        tr.querySelector('.btn-table-preview').addEventListener('click', () => openPreviewModal(doc));
        tr.querySelector('.table-doc-title').addEventListener('click', () => openPreviewModal(doc));
        tr.querySelector('.btn-table-download').addEventListener('click', () => downloadDocument(doc));
        tr.querySelector('.btn-table-delete').addEventListener('click', () => openDeleteModal(doc));

        fragment.appendChild(tr);
    });

    documentsTableBody.appendChild(fragment);
}

// ==========================================================================
// Preview Modal Handling
// ==========================================================================
function openPreviewModal(doc) {
    state.activeModalDoc = doc;

    if (modalDocTitle) {
        modalDocTitle.textContent = doc.name;
        modalDocTitle.title = doc.name;
    }
    if (modalDocMeta) {
        modalDocMeta.innerHTML = `
            <span><i class="fa-regular fa-clock"></i> Modificado: ${doc.mtime_formatted}</span>
            <span>&bull;</span>
            <span><i class="fa-regular fa-calendar-plus"></i> Criado: ${doc.ctime_formatted}</span>
            <span>&bull;</span>
            <span><i class="fa-solid fa-hard-drive"></i> ${doc.size_formatted}</span>
        `;
    }

    const pathParts = (doc.relative_path || doc.name).split('/').map(encodeURIComponent).join('/');
    const previewUrl = `/api/pdf/preview/${pathParts}`;
    if (btnModalNewTab) btnModalNewTab.href = previewUrl;
    if (btnMobileOpenPdf) btnMobileOpenPdf.href = previewUrl;

    if (modalLoading) modalLoading.classList.remove('hidden');
    if (pdfViewerFrame) pdfViewerFrame.src = previewUrl;

    if (previewModal) previewModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    if (previewModal) previewModal.classList.add('hidden');
    if (pdfViewerFrame) pdfViewerFrame.src = '';
    state.activeModalDoc = null;
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

        const response = await fetch('/api/oficios/delete', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ relative_path: doc.relative_path })
        });
        const data = await response.json();

        if (data.success) {
            state.allDocuments = state.allDocuments.filter(d => d.relative_path !== doc.relative_path && d.name !== doc.name);
            if (headerDocCount) headerDocCount.textContent = `${state.allDocuments.length} documentos`;
            applyFiltersAndRender();
            closeDeleteModal();
            if (state.activeModalDoc && state.activeModalDoc.relative_path === doc.relative_path) {
                closeModal();
            }
            showToast(data.message || 'Ofício removido com sucesso!', 'success');
        } else {
            if (data.error === 'github_token_required') {
                showToast(data.message, 'error');
                closeDeleteModal();
                openImportModal();
                if (importNoticeAlert && importNoticeMessage) {
                    importNoticeMessage.innerHTML = 'Para excluir ofícios permanentemente no Vercel, informe o <strong>GitHub Personal Access Token</strong> nas configurações abaixo ou adicione a variável <code>GITHUB_TOKEN</code> no painel da Vercel.';
                    importNoticeAlert.classList.remove('hidden');
                }
                toggleGithubSettings(true);
            } else {
                showToast(data.error || 'Erro ao excluir documento', 'error');
            }
        }
    } catch (err) {
        console.error('Erro ao excluir:', err);
        showToast('Erro de conexão ao excluir ofício', 'error');
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
        importModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        checkSystemStatus();
    }
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
        btnStartImport.innerHTML = `<i class="fa-solid fa-upload"></i> <span>Importar ${selectedImportFiles.length} Ofício(s)</span>`;
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
    const uploadedDocs = [];
    const errors = [];
    const token = localStorage.getItem('pmo_github_token') || '';

    for (let i = 0; i < totalFiles; i++) {
        const file = selectedImportFiles[i];
        const percent = Math.round(((i + 1) / totalFiles) * 100);
        if (importProgressFill) importProgressFill.style.width = `${Math.max(10, percent)}%`;
        if (importProgressLabel) importProgressLabel.textContent = `Enviando arquivo ${i + 1} de ${totalFiles}: ${file.name}...`;

        // Check file size: Vercel serverless limit is ~4.5 MB (4,718,592 bytes)
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

                const repoPath = `Base de dados Ofícios/Ofícios/${file.name}`;
                const ghUrl = `https://api.github.com/repos/alisonpersil/consulta-oficios/contents/${encodeURIComponent(repoPath)}`;

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
                    message: `feat: importar oficio ${file.name}`,
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
                uploadedDocs.push({
                    name: file.name,
                    size_formatted: `${(file.size / 1024).toFixed(1)} KB`,
                    relative_path: `Ofícios/${file.name}`,
                    ctime_formatted: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
                    category: 'Ofício',
                    year: '2026',
                    is_pdf: true
                });
            } else if (file.size > MAX_VERCEL_BYTES && !token) {
                errors.push(`${file.name}: Arquivo possui ${(file.size / (1024 * 1024)).toFixed(2)} MB (limite na Vercel é de 4.5 MB por arquivo). Configure o GitHub Token para upload direto ou comprima o PDF.`);
            } else {
                // Send individually to /api/oficios/upload
                const singleFormData = new FormData();
                singleFormData.append('files', file);

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
                if (data.success && data.documents && data.documents.length) {
                    successCount += data.documents.length;
                    uploadedDocs.push(...data.documents);
                } else if (data.error === 'github_token_required') {
                    showToast(data.message, 'error');
                    if (importNoticeAlert && importNoticeMessage) {
                        importNoticeMessage.innerHTML = 'Para que os ofícios sejam salvos permanentemente no Vercel, informe o <strong>GitHub Personal Access Token</strong> nas configurações abaixo ou adicione a variável <code>GITHUB_TOKEN</code> no painel da Vercel.';
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

    if (uploadedDocs.length > 0) {
        uploadedDocs.forEach(newDoc => {
            const existingIdx = state.allDocuments.findIndex(d => d.name === newDoc.name);
            if (existingIdx >= 0) {
                state.allDocuments[existingIdx] = newDoc;
            } else {
                state.allDocuments.unshift(newDoc);
            }
        });
        if (headerDocCount) headerDocCount.textContent = `${state.allDocuments.length} documentos`;
        applyFiltersAndRender();
    }

    if (errors.length === 0) {
        if (importProgressLabel) importProgressLabel.textContent = 'Upload concluído com sucesso!';
        setTimeout(() => {
            closeImportModal();
            showToast(`${successCount} ofício(s) importado(s) com sucesso!`, 'success');
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

// Theme handling (Default: Light/White)
function initTheme() {
    const savedTheme = localStorage.getItem('pmo_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('pmo_theme', newTheme);
    updateThemeIcon(newTheme);
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
