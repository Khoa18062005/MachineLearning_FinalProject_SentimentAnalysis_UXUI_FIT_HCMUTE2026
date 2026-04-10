const API_BASE = "http://127.0.0.1:8000/api";

// CÁC BIẾN QUẢN LÝ PHÂN TRANG
let globalData = [];
let currentPage = 1;
const rowsPerPage = 50;
let currentMode = 'raw';
let currentErrorModelName = '';

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

    } else if (tabName === 'train-models') {
        title.innerText = "Hiệu suất Huấn luyện Mô hình";
        desc.innerText = "So sánh tổng quan các thuật toán và confusion matrix tương ứng.";
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
            btn.className = id === setType
                ? "px-5 py-2 bg-blue-600 text-white rounded-lg font-medium transition-colors shadow-lg"
                : "px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors";
        }
    });

    let endpointUrl = `/dataset/${setType}`;
    if (currentMode === 'clean') endpointUrl = `/clean-dataset/${setType}`;

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

    currentErrorModelName = modelName;

    const title = document.getElementById('page-title');
    const desc = document.getElementById('page-desc');

    title.innerText = `Phân tích lỗi: ${modelName}`;
    desc.innerText = "Danh sách các văn bản bị mô hình dự đoán sai trên tập Test. Click từng dòng để xem giải thích.";

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

function clearContainerUI() {
    const container = document.getElementById('table-container');
    const table = container.querySelector('table');
    if (table) table.style.display = 'none';

    Array.from(container.children).forEach(child => {
        if (child.tagName !== 'TABLE') child.remove();
    });
}

function resolveChartKey(modelName) {
    if (modelName.includes("Multinomial") && modelName.includes("Custom")) return 'mnb_custom_cm';
    if (modelName.includes("Multinomial") && modelName.includes("Library")) return 'mnb_library_cm';
    if (modelName.includes("SVM")) return 'svm_cm';
    if (modelName.includes("XGBoost") && modelName.includes("Custom")) return 'xgb_custom_cm';
    if (modelName.includes("XGBoost") && modelName.includes("Library")) return 'xgb_library_cm';
    return 'unknown_cm';
}

function renderModelCards(data) {
    const container = document.getElementById('table-container');
    clearContainerUI();

    let htmlContent = `<div id="model-cards-wrapper" class="flex flex-col gap-8 p-6 w-full animate-fade-in">`;

    data.forEach(model => {
        const isTrained = !model.model_name.includes("(Chưa huấn luyện)");
        const borderColor = model.accuracy > 85 ? 'border-emerald-500' : 'border-blue-500';
        const cmChartKey = resolveChartKey(model.model_name);

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
                        ${model.f1_score !== undefined ? `
                        <div class="flex justify-between items-center bg-amber-900/20 p-3 rounded-lg border border-amber-500/20">
                            <span class="text-amber-400 text-sm"><i class="fas fa-scale-balanced mr-2"></i>F1-score:</span>
                            <span class="text-amber-400 font-mono font-bold">${model.f1_score}</span>
                        </div>` : ''}
                    </div>
                    <div class="mt-6 pt-4 border-t border-slate-700 text-center">
                        <p class="text-slate-400 text-sm mb-1">Accuracy</p>
                        <p class="text-4xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                            ${model.accuracy}%
                        </p>
                    </div>
                    <div class="text-center mt-3">
                        <span class="text-xs text-slate-500 italic"><i class="fas fa-hand-pointer mr-1"></i>Click để xem mẫu lỗi + lý do dự đoán</span>
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
    clearContainerUI();

    const tableContainer = document.getElementById('table-container');
    const table = tableContainer.querySelector('table');
    if (table) table.style.display = 'table';

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
        const encodedText = encodeURIComponent(item.text || '');

        return `
    <tr onclick="showProbDetails(decodeURIComponent('${encodedText}'))" class="transition-colors group border-b border-slate-800 ${rowBg} cursor-pointer hover:bg-blue-600/10">
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

function renderProbabilityCards(probabilities, predictedLabel) {
    const entries = Object.entries(probabilities || {});
    return `
        <div class="grid grid-cols-1 md:grid-cols-${Math.max(entries.length, 2)} gap-4">
            ${entries.map(([label, prob]) => `
                <div class="relative p-6 rounded-2xl border ${String(label) === String(predictedLabel) ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-800/40'}">
                    ${String(label) === String(predictedLabel) ? '<span class="absolute -top-3 left-6 px-3 py-1 bg-emerald-500 text-white text-[10px] font-black rounded-full uppercase">Mô hình chọn</span>' : ''}
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="text-white font-black text-xs uppercase tracking-widest">Nhãn ${label}</h4>
                        <span class="text-white font-mono font-bold text-xl">${(Number(prob) * 100).toFixed(2)}%</span>
                    </div>
                    <div class="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div class="bg-emerald-500 h-full transition-all duration-500" style="width: ${Number(prob) * 100}%"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderNaiveBayesDetails(text, data) {
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
    return html;
}

function renderXGBDetails(data, isCustom) {
    const summary = data.training_summary || {};
    const topFeatures = data.top_features || [];
    const topTrees = data.top_trees || [];
    const topGlobal = data.global_feature_gain || [];

    let html = `
        <div class="mb-8 p-6 bg-slate-900/50 rounded-2xl border border-slate-700 shadow-inner">
            <span class="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Văn bản đang phân tích</span>
            <h3 class="text-2xl text-white font-bold mt-1 font-serif">"${data.input_text}"</h3>
            <p class="text-slate-400 mt-3">${data.decision_reason || ''}</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div class="p-6 rounded-2xl border border-slate-700 bg-slate-800/40">
                <h4 class="text-blue-400 font-black uppercase tracking-wider text-sm mb-4">Kết quả cuối cùng</h4>
                <div class="space-y-3 text-sm">
                    <div class="flex justify-between"><span class="text-slate-400">Nhãn dự đoán</span><span class="text-white font-bold">${data.predicted_label}</span></div>
                    <div class="flex justify-between"><span class="text-slate-400">Threshold</span><span class="text-white font-mono">${Number(data.threshold).toFixed(4)}</span></div>
                    ${data.raw_score_logit !== undefined ? `<div class="flex justify-between"><span class="text-slate-400">Raw score (logit)</span><span class="text-white font-mono">${Number(data.raw_score_logit).toFixed(6)}</span></div>` : ''}
                    ${data.base_score_logit !== undefined ? `<div class="flex justify-between"><span class="text-slate-400">Base score</span><span class="text-white font-mono">${Number(data.base_score_logit).toFixed(6)}</span></div>` : ''}
                    ${data.bias !== undefined ? `<div class="flex justify-between"><span class="text-slate-400">Bias term</span><span class="text-white font-mono">${Number(data.bias).toFixed(6)}</span></div>` : ''}
                </div>
            </div>

            <div class="p-6 rounded-2xl border border-slate-700 bg-slate-800/40">
                <h4 class="text-emerald-400 font-black uppercase tracking-wider text-sm mb-4">Thông tin train / tune</h4>
                <div class="space-y-3 text-sm">
                    <div class="flex justify-between"><span class="text-slate-400">Thời gian train</span><span class="text-white font-mono">${Number(summary.training_time_sec || 0).toFixed(2)}s</span></div>
                    ${summary.best_score_val !== undefined ? `<div class="flex justify-between"><span class="text-slate-400">Best validation score</span><span class="text-white font-mono">${summary.best_score_val}</span></div>` : ''}
                    ${summary.best_score_cv !== undefined ? `<div class="flex justify-between"><span class="text-slate-400">Best CV score</span><span class="text-white font-mono">${summary.best_score_cv}</span></div>` : ''}
                    ${summary.n_trials !== undefined ? `<div class="flex justify-between"><span class="text-slate-400">Số trial tune</span><span class="text-white font-mono">${summary.n_trials}</span></div>` : ''}
                </div>
            </div>
        </div>

        <div class="mb-8">
            ${renderProbabilityCards(data.probabilities, data.predicted_label)}
        </div>

        <div class="mb-8 overflow-hidden rounded-2xl border border-slate-700 bg-[#1e293b]">
            <div class="px-6 py-4 bg-slate-700/40 border-b border-slate-700">
                <h4 class="text-white font-bold">Top feature ảnh hưởng đến quyết định</h4>
                <p class="text-slate-400 text-sm mt-1">${isCustom ? 'Xấp xỉ theo các node mà mẫu đã đi qua trong từng cây.' : 'Contribution lấy trực tiếp từ booster bằng pred_contribs.'}</p>
            </div>
            <table class="w-full text-left">
                <thead>
                    <tr class="bg-slate-700/50 text-[11px] uppercase tracking-wider text-slate-300">
                        <th class="px-6 py-4 font-bold">Feature</th>
                        <th class="px-6 py-4 font-bold text-center">TF-IDF</th>
                        <th class="px-6 py-4 font-bold text-center">${isCustom ? 'Approx contrib' : 'Contrib'}</th>
                        <th class="px-6 py-4 font-bold text-center">Hướng tác động</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-700/50 text-sm">
                    ${topFeatures.length ? topFeatures.map(item => `
                        <tr class="hover:bg-slate-700/20 transition-colors">
                            <td class="px-6 py-4 text-white font-medium">${item.feature}</td>
                            <td class="px-6 py-4 font-mono text-center text-blue-300">${Number(item.tfidf_value || 0).toFixed(6)}</td>
                            <td class="px-6 py-4 font-mono text-center ${Number((item.approx_contribution ?? item.contribution) || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${Number(item.approx_contribution ?? item.contribution ?? 0).toFixed(6)}</td>
                            <td class="px-6 py-4 text-center text-slate-300">${item.direction}</td>
                        </tr>
                    `).join('') : `
                        <tr><td colspan="4" class="px-6 py-8 text-center text-slate-500">Không có feature nổi bật để hiển thị.</td></tr>
                    `}
                </tbody>
            </table>
        </div>
    `;

    if (isCustom) {
        html += `
            <div class="mb-8 space-y-4">
                <div class="px-1">
                    <h4 class="text-white font-bold">Những cây ảnh hưởng mạnh nhất</h4>
                    <p class="text-slate-400 text-sm mt-1">Mỗi cây đóng góp một leaf weight; tổng các contribution tạo ra xác suất cuối.</p>
                </div>
                ${topTrees.map(tree => `
                    <div class="p-5 rounded-2xl border border-slate-700 bg-slate-800/40">
                        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                            <div>
                                <h5 class="text-blue-300 font-bold">Tree #${tree.tree_index}</h5>
                                <p class="text-slate-400 text-sm">Path length: ${tree.path_length} | leaf weight: ${Number(tree.leaf_weight).toFixed(6)}</p>
                            </div>
                            <div class="text-right">
                                <span class="text-xs uppercase tracking-widest text-slate-500 block">Contribution</span>
                                <span class="font-mono font-bold ${Number(tree.tree_contribution) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${Number(tree.tree_contribution).toFixed(6)}</span>
                            </div>
                        </div>
                        <div class="space-y-2">
                            ${tree.path.map(step => `
                                <div class="px-4 py-3 rounded-xl bg-slate-900/40 border border-slate-800 text-sm">
                                    <span class="text-white font-medium">${step.feature_name}</span>
                                    <span class="text-slate-400"> | value = </span><span class="font-mono text-blue-300">${Number(step.feature_value).toFixed(6)}</span>
                                    <span class="text-slate-400"> | threshold = </span><span class="font-mono text-amber-300">${Number(step.threshold).toFixed(6)}</span>
                                    <span class="text-slate-400"> | đi </span><span class="font-bold ${step.direction === 'left' ? 'text-emerald-400' : 'text-rose-400'}">${step.direction}</span>
                                </div>
                            `).join('') || '<div class="text-slate-500 italic">Cây này là leaf ngay từ root.</div>'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (topGlobal.length) {
        html += `
            <div class="mb-8 overflow-hidden rounded-2xl border border-slate-700 bg-[#1e293b]">
                <div class="px-6 py-4 bg-slate-700/40 border-b border-slate-700">
                    <h4 class="text-white font-bold">Feature mạnh toàn cục của model</h4>
                    <p class="text-slate-400 text-sm mt-1">Dựa trên importance type = gain.</p>
                </div>
                <table class="w-full text-left">
                    <thead>
                        <tr class="bg-slate-700/50 text-[11px] uppercase tracking-wider text-slate-300">
                            <th class="px-6 py-4 font-bold">Feature</th>
                            <th class="px-6 py-4 font-bold text-center">Gain</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-700/50 text-sm">
                        ${topGlobal.map(item => `
                            <tr class="hover:bg-slate-700/20 transition-colors">
                                <td class="px-6 py-4 text-white font-medium">${item.feature}</td>
                                <td class="px-6 py-4 font-mono text-center text-amber-300">${Number(item.gain).toFixed(6)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    if (summary.best_params || summary.params?.best_params) {
        const bestParams = summary.best_params || summary.params.best_params;
        html += `
            <div class="p-6 rounded-2xl border border-slate-700 bg-slate-800/40">
                <h4 class="text-white font-bold mb-4">Bộ tham số được chọn</h4>
                <pre class="text-sm text-emerald-300 whitespace-pre-wrap break-words">${JSON.stringify(bestParams, null, 2)}</pre>
            </div>
        `;
    }

    return html;
}

function renderUnsupportedDetails(message, modelName = '') {
    return `
        <div class="p-8 rounded-2xl border border-amber-500/30 bg-amber-500/10">
            <h4 class="text-amber-300 font-bold text-xl mb-3"><i class="fas fa-circle-info mr-2"></i>Chưa có chế độ giải thích chi tiết</h4>
            <p class="text-slate-200 leading-relaxed">${message || 'Model này hiện chưa hỗ trợ hiển thị chi tiết từng bước dự đoán trong giao diện.'}</p>
            ${modelName ? `<p class="text-slate-400 text-sm mt-3">Model hiện tại: <span class="text-white font-semibold">${modelName}</span></p>` : ''}
        </div>
    `;
}

async function showProbDetails(text) {
    if (currentMode !== 'errors') return;

    const modal = document.getElementById('prob-modal');
    const content = document.getElementById('modal-content');
    const titleNode = document.querySelector('#prob-modal h3');

    modal.classList.remove('hidden');
    titleNode.innerText = `Chi tiết quyết định mô hình: ${currentErrorModelName}`;
    content.innerHTML = `<div class="text-center py-20"><div class="loader mb-4 mx-auto"></div><p class="text-blue-400 font-medium">Đang trích xuất dữ liệu giải thích...</p></div>`;

    try {
        const res = await fetch(`${API_BASE}/model-details?model_name=${encodeURIComponent(currentErrorModelName)}&text=${encodeURIComponent(text)}`);
        const result = await res.json();

        if (result.status === "success") {
            const data = result.data;

            if (data.model_type === "xgb_custom") {
                content.innerHTML = renderXGBDetails(data, true);
            } else if (data.model_type === "xgb_library") {
                content.innerHTML = renderXGBDetails(data, false);
            } else if (data.model_type === "mnb_custom" || (data["0"] && data["4"])) {
                content.innerHTML = renderNaiveBayesDetails(text, data);
            } else {
                content.innerHTML = renderUnsupportedDetails("Backend đã trả dữ liệu nhưng chưa có template hiển thị phù hợp cho model này.", currentErrorModelName);
            }
        } else {
            content.innerHTML = renderUnsupportedDetails(result.message || "Không lấy được dữ liệu giải thích.", currentErrorModelName);
        }
    } catch (error) {
        console.error(error);
        content.innerHTML = `<div class="p-10 text-center text-rose-400 font-bold">Lỗi kết nối Backend!</div>`;
    }
}

function closeModal() {
    document.getElementById('prob-modal').classList.add('hidden');
}

function renderModelStudyChart(type) {
    const container = document.getElementById('table-container');
    const loading = document.getElementById('loading');
    const paginationControls = document.getElementById('pagination-controls');

    if (loading) loading.classList.add('hidden');
    if (paginationControls) paginationControls.classList.add('hidden');
    container.classList.remove('opacity-20');

    clearContainerUI();

    const titles = {
        'mnb': "Laplace smoothing - Multinomial Naive Bayes",
        'svm': "Gamma & C - Support Vector Machine",
        'xgb': "Max Depth - XGBoost Classifier"
    };

    const htmlContent = `
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
                     onerror="this.src='https://placehold.co/600x400/1e293b/475569?text=Chưa+có+dữ+liệu+${type.toUpperCase()}'">
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', htmlContent);
}

window.onload = () => changeTab('view-data');