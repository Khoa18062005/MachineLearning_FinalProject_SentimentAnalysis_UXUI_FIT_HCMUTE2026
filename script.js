const API_BASE = "http://127.0.0.1:8000/api";

// CÁC BIẾN QUẢN LÝ PHÂN TRANG
let globalData = [];       
let currentPage = 1;       
const rowsPerPage = 50;    
let currentMode = 'raw';   

async function changeTab(tabName) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${tabName}`).classList.add('active');

    const title = document.getElementById('page-title');
    const desc = document.getElementById('page-desc');
    const datasetControls = document.getElementById('dataset-controls');

    if (datasetControls) datasetControls.classList.add('hidden');

    if (tabName === 'view-data') {
        title.innerText = "Dữ liệu thô";
        desc.innerText = "Dữ liệu thô từ hệ thống (file csv).";
        fetchAndRenderTable("/preview-data");

    } else if (tabName === 'view-dataset') {
        currentMode = 'raw'; 
        title.innerText = "Xem các tập dữ liệu";
        desc.innerText = "Dữ liệu đã được chia thành Train: 80% | Validation: 10% của Train | Test: 20%";
        if (datasetControls) datasetControls.classList.remove('hidden'); 
        loadSubDataset('train'); 

    } else if (tabName === 'view-clean-dataset') {
        currentMode = 'clean'; 
        title.innerText = "Dữ liệu đưa vào huấn luyện";
        desc.innerText = "Dữ liệu đã qua bước Tiền xử lý: Xóa URL, mention, số, ký tự đặc biệt, emoji.";
        if (datasetControls) datasetControls.classList.remove('hidden');
        loadSubDataset('train');

    } else if (tabName === 'process-outliers') {
        title.innerText = "Dữ liệu đã Xử lý";
        desc.innerText = "Kết quả sau khi loại bỏ nhiễu và chuẩn hóa.";
        fetchAndRenderTable("/process-outliers");

    } else if (tabName === 'train-models') {
        title.innerText = "Hiệu suất Huấn luyện Mô hình";
        desc.innerText = "So sánh tổng quan 3 thuật toán: Multinomial NB, SVM và XGBoost.";
        if (datasetControls) datasetControls.classList.add('hidden');
        fetchAndRenderModelCards("/train-models");

    } else if (tabName === 'visualize-params') {
        title.innerText = "Trực quan hóa tham số mô hình";
        desc.innerText = "Phân tích sự biến thiên của Accuracy dựa trên các tham số đặc trưng.";
        if (datasetControls) datasetControls.classList.add('hidden');
        renderModelStudyChart('mnb');
        
    } else if (tabName === 'test-text') {
        title.innerText = "Công cụ AI Phân tích Cảm xúc";
        desc.innerText = "Hệ thống sẽ tiền xử lý dữ liệu và yêu cầu 6 AI Agent thực hiện bỏ phiếu chéo.";
        if (datasetControls) datasetControls.classList.add('hidden');
        renderTestTextUI(); 
    }
}

async function loadSubDataset(setType) {
    ['train', 'val', 'test'].forEach(id => {
        const btn = document.getElementById(`btn-sub-${id}`);
        if (btn) {
            if (id === setType) {
                btn.className = "px-5 py-2 bg-blue-600 text-white rounded-lg font-medium transition-colors shadow-lg";
            } else {
                btn.className = "px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors";
            }
        }
    });

    let endpointUrl = `/dataset/${setType}`;
    if (currentMode === 'clean') {
        endpointUrl = `/clean-dataset/${setType}`;
    }

    const result = await fetchAndRenderTable(endpointUrl);

    if (result && result.counts) {
        const countText = `Tổng số mẫu - Train: ${result.counts.train_count.toLocaleString()} | Val: ${result.counts.val_count.toLocaleString()} | Test: ${result.counts.test_count.toLocaleString()}`;
        document.getElementById('dataset-counts').innerText = countText;
    }
}

async function fetchAndRenderTable(endpoint) {
    const loading = document.getElementById('loading');
    const container = document.getElementById('table-container');
    const paginationControls = document.getElementById('pagination-controls');

    container.classList.add('opacity-20');
    loading.classList.remove('hidden');
    if (paginationControls) paginationControls.classList.add('hidden'); 

    try {
        const res = await fetch(`${API_BASE}${endpoint}`);
        const result = await res.json();

        if (result.status === "success") {
            globalData = result.data;
            currentPage = 1;

            setTimeout(() => {
                renderTable(); 
                loading.classList.add('hidden');
                container.classList.remove('opacity-100'); 
                container.classList.remove('opacity-20');
            }, 300);

            return result; 
        }
    } catch (error) {
        console.error("Lỗi kết nối:", error);
        loading.innerHTML = '<p class="text-red-500">Lỗi: Không thể kết nối tới Python Backend!</p>';
    }
    return null;
}

async function fetchAndRenderModelCards(endpoint) {
    const loading = document.getElementById('loading');
    const container = document.getElementById('table-container');
    const paginationControls = document.getElementById('pagination-controls');

    container.classList.add('opacity-20');
    loading.classList.remove('hidden');
    if (paginationControls) paginationControls.classList.add('hidden');

    try {
        const res = await fetch(`${API_BASE}${endpoint}`);
        const result = await res.json();

        if (result.status === "success") {
            setTimeout(() => {
                renderModelCards(result.data);
                loading.classList.add('hidden');
                container.classList.remove('opacity-100', 'opacity-20');
            }, 300);
        }
    } catch (error) {
        console.error("Lỗi kết nối:", error);
        loading.innerHTML = '<p class="text-red-500">Lỗi kết nối Backend lấy thông tin Mô hình!</p>';
    }
}

async function viewModelErrors(modelName) {
    if (modelName.includes("(Chưa huấn luyện)")) return;

    const title = document.getElementById('page-title');
    const desc = document.getElementById('page-desc');

    title.innerText = `Phân tích lỗi: ${modelName}`;
    desc.innerText = "Danh sách các văn bản bị thuật toán dự đoán sai trên tập Test.";

    Array.from(document.getElementById('table-container').children).forEach(child => {
        if (child.tagName !== 'TABLE') child.remove();
    });
    
    const container = document.getElementById('table-container');
    container.querySelector('table').style.display = 'table';

    setupBackButton(true); 

    const loading = document.getElementById('loading');
    container.classList.add('opacity-20');
    loading.classList.remove('hidden');

    try {
        const res = await fetch(`${API_BASE}/model-errors?model_name=${encodeURIComponent(modelName)}`);
        const result = await res.json();

        if (result.status === "success") {
            globalData = result.data;
            currentPage = 1;
            currentMode = 'errors'; 

            setTimeout(() => {
                renderTable();
                loading.classList.add('hidden');
                container.classList.remove('opacity-20');
            }, 300);
        }
    } catch (error) {
        console.error("Lỗi:", error);
        loading.innerHTML = '<p class="text-red-500">Lỗi khi tải dữ liệu phân tích!</p>';
    }
}

function setupBackButton(show) {
    let backBtn = document.getElementById('back-to-models-btn');
    if (!backBtn) {
        backBtn = document.createElement('button');
        backBtn.id = 'back-to-models-btn';
        backBtn.className = 'mb-4 px-5 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition-colors shadow-lg';
        backBtn.innerHTML = '<i class="fas fa-arrow-left mr-2"></i> Quay lại So sánh Mô hình';
        backBtn.onclick = () => {
            setupBackButton(false);
            changeTab('train-models'); 
        };
        const wrapper = document.querySelector('.table-wrapper');
        wrapper.parentNode.insertBefore(backBtn, wrapper);
    }
    backBtn.style.display = show ? 'inline-block' : 'none';
}

// =========================================================
// HÀM QUÉT SẠCH CONTAINER (FIX LỖI CHỒNG LẤN GIAO DIỆN)
// =========================================================
function clearContainerUI() {
    const container = document.getElementById('table-container');
    const table = container.querySelector('table');
    if (table) table.style.display = 'none'; // Ẩn bảng
    
    // Xóa SẠCH tất cả mọi thứ (Biểu đồ, Model Card, Input Nhập liệu...) TRỪ cái bảng
    Array.from(container.children).forEach(child => {
        if (child.tagName !== 'TABLE') child.remove();
    });
}

function renderModelCards(data) {
    const container = document.getElementById('table-container');
    clearContainerUI(); // Dọn dẹp

    let htmlContent = `<div id="model-cards-wrapper" class="flex flex-col gap-8 p-6 w-full animate-fade-in">`;

    data.forEach(model => {
        const isTrained = !model.model_name.includes("(Chưa huấn luyện)");
        let borderColor = model.accuracy > 85 ? 'border-emerald-500' : 'border-blue-500';
        
        let cmChartKey = '';
        if (model.model_name.includes("Custom")) cmChartKey = 'mnb_custom_cm';
        else if (model.model_name.includes("Library")) cmChartKey = 'mnb_library_cm';
        else if (model.model_name.includes("SVM")) cmChartKey = 'svm_cm';
        else if (model.model_name.includes("XGBoost")) cmChartKey = 'xgb_cm';

        htmlContent += `
            <div class="flex flex-col lg:flex-row gap-6 bg-slate-800/40 p-6 rounded-2xl border border-slate-700 items-stretch">
                <div onclick="viewModelErrors('${model.model_name}')" 
                     class="w-full lg:w-1/4 bg-slate-800 rounded-xl p-6 border-t-4 ${borderColor} shadow-lg hover:transform hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between">
                    <h3 class="text-xl font-bold text-white mb-4 text-center">${model.model_name}</h3>
                    <div class="space-y-4">
                        <div class="flex justify-between items-center bg-slate-700/50 p-3 rounded-lg">
                            <span class="text-slate-400 text-sm"><i class="fas fa-clock mr-2"></i>Thời gian:</span>
                            <span class="text-white font-mono font-bold">${model.training_time_sec}s</span>
                        </div>
                        <div class="flex justify-between items-center bg-emerald-900/20 p-3 rounded-lg border border-emerald-500/20">
                            <span class="text-emerald-400 text-sm"><i class="fas fa-check-circle mr-2"></i>Đúng:</span>
                            <span class="text-emerald-400 font-mono font-bold">${model.correct_predictions.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between items-center bg-rose-900/20 p-3 rounded-lg border border-rose-500/20">
                            <span class="text-rose-400 text-sm"><i class="fas fa-times-circle mr-2"></i>Sai:</span>
                            <span class="text-rose-400 font-mono font-bold">${model.incorrect_predictions.toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="mt-6 pt-4 border-t border-slate-700 text-center">
                        <p class="text-slate-400 text-sm mb-1">Hiệu suất (Accuracy)</p>
                        <p class="text-4xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                            ${model.accuracy}%
                        </p>
                    </div>
                    <div class="text-center mt-3">
                        <span class="text-xs text-slate-500 italic"><i class="fas fa-hand-pointer mr-1"></i>Click để xem chi tiết lỗi</span>
                    </div>
                </div>

                <div class="w-full lg:w-3/4 bg-[#1e293b] rounded-xl border border-slate-700 p-4 flex flex-col items-center justify-center relative overflow-hidden">
                    ${isTrained ? `
                        <img src="${API_BASE}/charts/${cmChartKey}?t=${new Date().getTime()}" 
                             class="w-full h-auto max-h-[450px] object-contain rounded-lg shadow-md"
                             onerror="this.parentElement.innerHTML='<div class=\\'flex flex-col items-center justify-center h-full text-slate-500 italic\\'><i class=\\'fas fa-image text-3xl mb-2 opacity-50\\'></i><p>Chưa có ảnh biểu đồ ${cmChartKey}.png</p></div>'">
                    ` : `
                        <div class="text-slate-600 italic flex flex-col items-center justify-center h-full">
                            <i class="fas fa-chart-bar text-4xl mb-3 opacity-20"></i>
                            <p>Hãy huấn luyện mô hình để xem biểu đồ</p>
                        </div>
                    `}
                </div>
            </div>
        `;
    });

    htmlContent += `</div>`;
    container.insertAdjacentHTML('beforeend', htmlContent);
}

function renderTable() {
    clearContainerUI(); // Dọn dẹp trước
    
    const tableContainer = document.getElementById('table-container');
    const table = tableContainer.querySelector('table');
    if (table) table.style.display = 'table'; // Hiển thị lại thẻ table

    const headerRow = document.getElementById('table-header');
    const bodyRow = document.getElementById('table-body');
    const paginationControls = document.getElementById('pagination-controls');

    if (!globalData || globalData.length === 0) {
        bodyRow.innerHTML = "<tr><td colspan='10' class='p-20 text-center text-slate-500'>Không tìm thấy dữ liệu.</td></tr>";
        if (paginationControls) paginationControls.classList.add('hidden');
        return;
    }

    const totalPages = Math.ceil(globalData.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedData = globalData.slice(startIndex, endIndex);

    const columnMapping = {
        "target": "Cảm xúc", "id": "Mã ID", "date": "Thời gian",
        "flag": "Flag", "user": "Người dùng", "text": "Nội dung Tweet"
    };

    const columns = Object.keys(globalData[0]).filter(col => col !== 'needs_processing');

    headerRow.innerHTML = `<tr>${columns.map(col => `
        <th class="px-6 py-4 font-bold text-[11px] uppercase tracking-wider border-b border-slate-600">
            ${columnMapping[col] || col}
        </th>`).join('')}</tr>`;

    bodyRow.innerHTML = paginatedData.map(item => {
        const isDirty = item.needs_processing === true;
        const rowBg = isDirty ? 'bg-red-500/10' : 'hover:bg-blue-500/5';
        const escapedText = item.text ? item.text.replace(/'/g, "\\'") : "";

        return `
    <tr onclick="showProbDetails('${escapedText}')" class="transition-colors group border-b border-slate-800 ${rowBg} cursor-pointer hover:bg-blue-600/10">
        ${columns.map(col => {
            const value = item[col];
            const isLongText = col === 'text' || col === 'C6';
            let textColor = 'text-slate-400';
            if (typeof value === 'number') textColor = 'font-mono text-emerald-400';
            if (col.toLowerCase() === 'predicted') textColor = 'font-mono text-red-500 font-bold';
            if (isDirty && isLongText) textColor = 'text-red-400 font-medium';

            return `<td class="px-6 py-4 text-sm ${isLongText ? 'max-w-md truncate' : 'whitespace-nowrap'} ${textColor}">${value}</td>`;
        }).join('')}
    </tr>`}).join('');

    if (paginationControls) {
        paginationControls.classList.remove('hidden');
        renderPaginationControls(totalPages);
    }
}

function renderPaginationControls(totalPages) {
    const paginationControls = document.getElementById('pagination-controls');
    if (!paginationControls) return;

    paginationControls.innerHTML = `
        <div class="text-sm text-slate-400">
            Đang hiển thị trang <span class="font-bold text-white">${currentPage}</span> / ${totalPages} 
            (Tổng số: <span class="text-emerald-400">${globalData.length}</span> mẫu)
        </div>
        <div class="flex space-x-2">
            <button onclick="prevPage()" class="px-4 py-2 bg-[#334155] hover:bg-[#475569] text-white rounded-lg transition-colors disabled:opacity-50" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left mr-1"></i> Trước</button>
            <button onclick="nextPage(${totalPages})" class="px-4 py-2 bg-[#334155] hover:bg-[#475569] text-white rounded-lg transition-colors disabled:opacity-50" ${currentPage === totalPages ? 'disabled' : ''}>Sau <i class="fas fa-chevron-right ml-1"></i></button>
        </div>
    `;
}

function prevPage() { if (currentPage > 1) { currentPage--; renderTable(); } }
function nextPage(totalPages) { if (currentPage < totalPages) { currentPage++; renderTable(); } }

async function showProbDetails(text) {
    if (currentMode !== 'errors') return;
    const modal = document.getElementById('prob-modal');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `<div class="text-center py-20"><div class="loader mb-4 mx-auto"></div><p class="text-blue-400 font-medium">Đang trích xuất dữ liệu xác suất...</p></div>`;

    try {
        const res = await fetch(`${API_BASE}/model-details?text=${encodeURIComponent(text)}`);
        const result = await res.json();

        if (result.status === "success") {
            const data = result.data;
            const labels = Object.keys(data);
            const words = data[labels[0]].word_steps.map(s => s.word);

            const s0 = data["0"].final_score;
            const s4 = data["4"].final_score;
            const total = s0 + s4;
            const conf0 = total > 0 ? (s0 / total) * 100 : 50;
            const conf4 = total > 0 ? (s4 / total) * 100 : 50;

            let html = `
                <div class="mb-8 p-6 bg-slate-900/50 rounded-2xl border border-slate-700 shadow-inner">
                    <span class="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Phân tích văn bản đầu vào:</span>
                    <h3 class="text-2xl text-white font-bold mt-1 font-serif">"${text}"</h3>
                </div>
                <div class="mb-8 overflow-hidden rounded-2xl border border-slate-700 bg-[#1e293b]">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="bg-slate-700/50 text-[11px] uppercase tracking-wider text-slate-300">
                                <th class="px-6 py-4 font-bold">Từ khóa (Feature)</th>
                                <th class="px-6 py-4 font-bold text-rose-400 text-center">P(word | Nhãn 0)</th>
                                <th class="px-6 py-4 font-bold text-emerald-400 text-center">P(word | Nhãn 4)</th>
                                <th class="px-6 py-4 font-bold text-slate-400 text-center">Ưu thế</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-700/50 text-sm">
            `;

            words.forEach((word, i) => {
                const p0 = data["0"].word_steps[i].prob;
                const p4 = data["4"].word_steps[i].prob;
                const winnerColor = p0 > p4 ? "text-rose-400" : "text-emerald-400";
                html += `
                    <tr class="hover:bg-slate-700/20 transition-colors">
                        <td class="px-6 py-4 text-white font-medium">${word}</td>
                        <td class="px-6 py-4 font-mono text-center ${p0 > p4 ? 'text-rose-400 font-bold' : 'text-slate-500'}">${p0.toFixed(6)}</td>
                        <td class="px-6 py-4 font-mono text-center ${p4 > p0 ? 'text-emerald-400 font-bold' : 'text-slate-500'}">${p4.toFixed(6)}</td>
                        <td class="px-6 py-4 text-center"><span class="px-2 py-1 rounded text-[10px] font-bold bg-slate-700/50 ${winnerColor}">${p0 > p4 ? "Nhãn 0" : "Nhãn 4"}</span></td>
                    </tr>`;
            });
            html += `</tbody></table></div>`;

            html += `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="relative p-6 rounded-2xl border ${s0 > s4 ? 'border-rose-500 bg-rose-500/10' : 'border-slate-700 bg-slate-800/40'}">
                        ${s0 > s4 ? '<span class="absolute -top-3 left-6 px-3 py-1 bg-rose-500 text-white text-[10px] font-black rounded-full uppercase">Mô hình chọn</span>' : ''}
                        <div class="flex justify-between items-center mb-4">
                            <div><h4 class="text-rose-400 font-black text-xs uppercase tracking-widest">Tiêu cực (Label 0)</h4></div>
                            <span class="text-white font-mono font-bold text-xl">${conf0.toFixed(2)}%</span>
                        </div>
                        <div class="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-2"><div class="bg-rose-500 h-full transition-all duration-500" style="width: ${conf0}%"></div></div>
                    </div>
                    <div class="relative p-6 rounded-2xl border ${s4 > s0 ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-800/40'}">
                        ${s4 > s0 ? '<span class="absolute -top-3 left-6 px-3 py-1 bg-emerald-500 text-white text-[10px] font-black rounded-full uppercase">Mô hình chọn</span>' : ''}
                        <div class="flex justify-between items-center mb-4">
                            <div><h4 class="text-emerald-400 font-black text-xs uppercase tracking-widest">Tích cực (Label 4)</h4></div>
                            <span class="text-white font-mono font-bold text-xl">${conf4.toFixed(2)}%</span>
                        </div>
                        <div class="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-2"><div class="bg-emerald-500 h-full transition-all duration-500" style="width: ${conf4}%"></div></div>
                    </div>
                </div>`;
            content.innerHTML = html;
        }
    } catch (error) {
        content.innerHTML = `<div class="p-10 text-center text-rose-400 font-bold">Lỗi kết nối Backend!</div>`;
    }
}

function closeModal() { document.getElementById('prob-modal').classList.add('hidden'); }

function renderModelStudyChart(type) {
    const container = document.getElementById('table-container');
    const loading = document.getElementById('loading');
    const paginationControls = document.getElementById('pagination-controls');

    if (loading) loading.classList.add('hidden');
    if (paginationControls) paginationControls.classList.add('hidden'); 
    container.classList.remove('opacity-20');

    clearContainerUI(); // Dọn dẹp trước

    const titles = {
        'mnb': "Laplace smoothing - Multinomial Naive Bayes",
        'svm': "Gamma & C - Support Vector Machine",
        'xgb': "Max Depth - XGBoost Classifier"
    };

    let htmlContent = `
        <div id="chart-study-wrapper" class="p-8 flex flex-col items-center bg-slate-800/30 rounded-2xl border border-slate-700 w-full animate-fade-in">
            <div class="flex gap-4 mb-8 bg-slate-900/50 p-1 rounded-xl border border-slate-700">
                <button onclick="renderModelStudyChart('mnb')" class="px-4 py-2 rounded-lg text-sm ${type === 'mnb' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:text-white transition-colors'}">MNB</button>
                <button onclick="renderModelStudyChart('svm')" class="px-4 py-2 rounded-lg text-sm ${type === 'svm' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:text-white transition-colors'}">SVM</button>
                <button onclick="renderModelStudyChart('xgb')" class="px-4 py-2 rounded-lg text-sm ${type === 'xgb' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:text-white transition-colors'}">XGBoost</button>
            </div>
            <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <i class="fas fa-chart-area text-pink-400"></i> ${titles[type]}
            </h3>
            <div class="w-full flex justify-center">
                <img src="${API_BASE}/charts/${type}?t=${new Date().getTime()}" 
                     class="rounded-xl shadow-2xl border border-slate-600 max-w-4xl h-auto"
                     onerror="this.src='https://placehold.co/600x400/1e293b/475569?text=Chưa+có+dữ liệu+${type.toUpperCase()}'">
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', htmlContent);
}

// ==========================================
// TÍNH NĂNG KIỂM THỬ VĂN BẢN (INFERENCE) - NÂNG CẤP UI/UX
// ==========================================
function renderTestTextUI() {
    const container = document.getElementById('table-container');
    
    // ẨN THANH PHÂN TRANG
    const paginationControls = document.getElementById('pagination-controls');
    if (paginationControls) paginationControls.classList.add('hidden');

    clearContainerUI(); // Dọn dẹp sạch sẽ các thẻ cũ

    const htmlContent = `
        <div id="test-text-wrapper" class="w-full max-w-[1100px] mx-auto flex flex-col gap-8 animate-fade-in pb-10 pt-5">
            <div class="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-3xl border border-slate-700 shadow-[0_8px_30px_rgb(0,0,0,0.5)] relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500"></div>
                
                <h3 class="text-white font-bold mb-6 text-xl flex items-center">
                    <i class="fas fa-robot text-orange-400 mr-3 text-2xl"></i> Trợ lý AI Đánh giá Cảm xúc
                </h3>
                
                <div class="relative">
                    <textarea id="text-input" rows="4" 
                              class="w-full bg-[#0f172a]/80 text-slate-100 p-5 rounded-2xl border border-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none resize-none text-lg transition-all" 
                              placeholder="Hãy dán một dòng bình luận, phản hồi hoặc bài đăng vào đây..."></textarea>
                    
                    <button onclick="submitTestText()" class="absolute bottom-4 right-4 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold shadow-lg shadow-orange-500/30 transition-transform transform hover:-translate-y-0.5 flex items-center gap-2">
                        <i class="fas fa-magic"></i> Phân tích ngay
                    </button>
                </div>
            </div>

            <div id="test-results-container" class="hidden flex flex-col gap-6"></div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', htmlContent);
}

async function submitTestText() {
    const rawText = document.getElementById('text-input').value.trim();
    if (!rawText) {
        alert("Vui lòng nhập nội dung văn bản!");
        return;
    }

    const resultsContainer = document.getElementById('test-results-container');
    resultsContainer.classList.remove('hidden');
    resultsContainer.innerHTML = `
        <div class="p-16 text-center bg-slate-800/40 rounded-3xl border border-slate-700">
            <div class="loader mb-6 mx-auto border-orange-500 border-t-transparent w-12 h-12"></div>
            <p class="text-orange-400 font-bold text-lg animate-pulse">Các mô hình đang hội ý và tiến hành bỏ phiếu...</p>
        </div>`;

    try {
        const res = await fetch(`${API_BASE}/predict-text?text=${encodeURIComponent(rawText)}`);
        const result = await res.json();

        if (result.status === "success") {
            const data = result.data;

            const getLabelUI = (predCode, isGiant = false) => {
                const sizeClasses = isGiant ? "px-6 py-3 text-xl font-black tracking-widest" : "px-3 py-1 text-sm font-bold";
                if (predCode === 4) return `<span class="${sizeClasses} bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)]">TÍCH CỰC</span>`;
                if (predCode === 0) return `<span class="${sizeClasses} bg-rose-500/20 text-rose-400 border border-rose-500/50 rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.3)]">TIÊU CỰC</span>`;
                return `<span class="${sizeClasses} bg-slate-700/50 text-slate-400 border border-slate-600 rounded-xl font-medium italic">Chưa Train</span>`;
            };

            const html = `
                <div class="bg-slate-800/60 backdrop-blur-md p-6 rounded-2xl border border-slate-700 shadow-lg">
                    <h4 class="text-slate-400 text-xs uppercase tracking-widest font-bold mb-3 flex items-center">
                        <i class="fas fa-broom text-blue-400 mr-2"></i> Dữ liệu sau bước Tiền xử lý
                    </h4>
                    <p class="text-emerald-300 font-mono bg-[#0f172a] p-4 rounded-xl border border-slate-700/50 text-lg">
                        ${data.cleaned_text || "<span class='text-slate-600 italic'>Chuỗi rỗng (Toàn bộ ký tự đã bị bộ lọc xóa bỏ)</span>"}
                    </p>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    <div class="bg-slate-800/60 backdrop-blur-md p-6 rounded-2xl border border-slate-700 shadow-lg hover:border-blue-500/30 transition-colors">
                        <div class="flex justify-between items-center mb-6 pb-4 border-b border-slate-700/50">
                            <h4 class="text-blue-400 font-black uppercase tracking-wider text-lg"><i class="fas fa-microchip mr-2"></i>Nhóm Custom</h4>
                            <div class="text-right">
                                <span class="text-[9px] text-slate-500 block uppercase font-bold tracking-widest mb-1 pl-1000">Quyết định Nhóm</span>
                                ${getLabelUI(data.votes.custom)}
                            </div>
                        </div>
                        <div class="space-y-5">
                            <div class="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800"><span class="text-slate-300 font-medium">Multinomial NB</span> ${getLabelUI(data.custom.mnb)}</div>
                            <div class="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800"><span class="text-slate-300 font-medium">Support Vector Machine</span> ${getLabelUI(data.custom.svm)}</div>
                            <div class="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800"><span class="text-slate-300 font-medium">XGBoost Classifier</span> ${getLabelUI(data.custom.xgb)}</div>
                        </div>
                    </div>

                    <div class="bg-slate-800/60 backdrop-blur-md p-6 rounded-2xl border border-slate-700 shadow-lg hover:border-emerald-500/30 transition-colors">
                        <div class="flex justify-between items-center mb-6 pb-4 border-b border-slate-700/50">
                            <h4 class="text-emerald-400 font-black uppercase tracking-wider text-lg"><i class="fas fa-book mr-2"></i>Nhóm Library</h4>
                            <div class="text-right">
                                <span class="text-[9px] text-slate-500 block uppercase font-bold tracking-widest mb-1">Quyết định Nhóm</span>
                                ${getLabelUI(data.votes.library)}
                            </div>
                        </div>
                        <div class="space-y-5">
                            <div class="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800"><span class="text-slate-300 font-medium">Multinomial NB</span> ${getLabelUI(data.library.mnb)}</div>
                            <div class="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800"><span class="text-slate-300 font-medium">Support Vector Machine</span> ${getLabelUI(data.library.svm)}</div>
                            <div class="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800"><span class="text-slate-300 font-medium">XGBoost Classifier</span> ${getLabelUI(data.library.xgb)}</div>
                        </div>
                    </div>

                </div>

                <div class="bg-gradient-to-r from-slate-800 to-[#0f172a] p-8 rounded-3xl border-2 border-slate-600 flex flex-col md:flex-row justify-between items-center shadow-2xl relative overflow-hidden mt-2">
                    <div class="absolute inset-0 bg-blue-500/5 mix-blend-overlay"></div>
                    <div class="z-10 text-center md:text-left mb-6 md:mb-0">
                        <h3 class="text-3xl font-black text-white tracking-tight"><i class="fas fa-gavel text-amber-400 mr-3"></i>Kết luận chung cuộc</h3>
                        <p class="text-slate-400 text-sm mt-2">Dựa trên phiếu bầu từ nhóm Library (Mức độ tin cậy ưu tiên)</p>
                    </div>
                    <div class="z-10">
                        ${getLabelUI(data.votes.final, true)}
                    </div>
                </div>
            `;
            resultsContainer.innerHTML = html;
        }
    } catch (error) {
        resultsContainer.innerHTML = `<div class="p-6 bg-rose-500/10 border border-rose-500/50 text-rose-400 rounded-xl text-center font-bold">Lỗi kết nối tới Server. Hãy đảm bảo API đang chạy!</div>`;
    }
}

window.onload = () => changeTab('view-data');