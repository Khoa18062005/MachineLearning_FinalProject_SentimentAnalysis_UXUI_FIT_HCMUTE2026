const API_BASE = "http://127.0.0.1:8000/api";

// CÁC BIẾN QUẢN LÝ PHÂN TRANG
let globalData = [];       // Lưu trữ toàn bộ dữ liệu tải về
let currentPage = 1;       // Trang hiện tại
const rowsPerPage = 50;    // Số dòng trên mỗi trang (có thể tùy chỉnh)
let currentMode = 'raw';   // Cờ để xem dữ liệu gốc hoặc dữ liệu thật

async function changeTab(tabName) {
    // Cập nhật trạng thái nút menu bên trái
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${tabName}`).classList.add('active');

    const title = document.getElementById('page-title');
    const desc = document.getElementById('page-desc');
    const datasetControls = document.getElementById('dataset-controls');

    // Mặc định ẩn 3 nút bấm (Train, Val, Test) đi, chỉ hiện khi ở đúng Tab
    if (datasetControls) datasetControls.classList.add('hidden');

    // Điều hướng dựa vào tab được chọn
    if (tabName === 'view-data') {
        title.innerText = "Dữ liệu thô";
        desc.innerText = "Dữ liệu thô từ hệ thống (file csv).";
        fetchAndRenderTable("/preview-data");

    } else if (tabName === 'view-dataset') {
        currentMode = 'raw'; // <--- ĐÃ THÊM DÒNG NÀY ĐỂ FIX LỖI
        title.innerText = "Xem các tập dữ liệu";
        desc.innerText = "Dữ liệu đã được chia thành Train: 80% | Validation: 10% của Train | Test: 20%";
        if (datasetControls) datasetControls.classList.remove('hidden'); // Hiện 3 nút bấm lên
        loadSubDataset('train'); // Mặc định hiển thị tập train trước tiên

    } else if (tabName === 'view-clean-dataset') {
        currentMode = 'clean'; // Set cờ là dữ liệu sạch
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

        // Mặc định hiện MNB
        renderModelStudyChart('mnb');
    }
}

// Xử lý khi click vào nút Train, Val, hoặc Test
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

    // QUAN TRỌNG: Kiểm tra xem đang ở Tab nào để gọi đúng Endpoint API
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

// HÀM CHUNG: Chuyên làm nhiệm vụ gọi API và hiển thị loading
async function fetchAndRenderTable(endpoint) {
    const loading = document.getElementById('loading');
    const container = document.getElementById('table-container');
    const paginationControls = document.getElementById('pagination-controls');

    container.classList.add('opacity-20');
    loading.classList.remove('hidden');
    if (paginationControls) paginationControls.classList.add('hidden'); // Ẩn phân trang khi đang tải

    try {
        const res = await fetch(`${API_BASE}${endpoint}`);
        const result = await res.json();

        if (result.status === "success") {
            // LƯU DỮ LIỆU VÀ RESET TRANG VỀ 1
            globalData = result.data;
            currentPage = 1;

            setTimeout(() => {
                renderTable(); // Gọi hàm render không cần truyền param
                loading.classList.add('hidden');
                container.classList.remove('opacity-100'); // Clean class cũ nếu có
                container.classList.remove('opacity-20');
            }, 300);

            return result; // Trả về data để hàm loadSubDataset lấy thông tin counts
        }
    } catch (error) {
        console.error("Lỗi kết nối:", error);
        loading.innerHTML = '<p class="text-red-500">Lỗi: Không thể kết nối tới Python Backend!</p>';
    }
    return null;
}

// === CÁC HÀM MỚI BỔ SUNG CHO TÍNH NĂNG MODEL CARDS ===

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
// --- HÀM GỌI API LẤY DANH SÁCH LỖI ---
async function viewModelErrors(modelName) {
    if (modelName.includes("(Chưa huấn luyện)")) return;

    const title = document.getElementById('page-title');
    const desc = document.getElementById('page-desc');

    title.innerText = `Phân tích lỗi: ${modelName}`;
    desc.innerText = "Danh sách các văn bản bị thuật toán dự đoán sai trên tập Test.";

    // Ẩn 3 tấm thẻ đi, hiện lại Bảng
    document.getElementById('model-cards-wrapper').style.display = 'none';
    const container = document.getElementById('table-container');
    container.querySelector('table').style.display = 'table';

    setupBackButton(true); // Hiện nút Quay lại

    const loading = document.getElementById('loading');
    container.classList.add('opacity-20');
    loading.classList.remove('hidden');

    try {
        // GỌI API BACKEND: /model-errors
        const res = await fetch(`${API_BASE}/model-errors?model_name=${encodeURIComponent(modelName)}`);
        const result = await res.json();

        if (result.status === "success") {
            globalData = result.data;
            currentPage = 1;
            currentMode = 'errors'; // Đánh dấu trạng thái đang xem lỗi

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

// --- HÀM TẠO NÚT QUAY LẠI KHI XEM CÁC HÀNG LỖI ---
function setupBackButton(show) {
    let backBtn = document.getElementById('back-to-models-btn');
    if (!backBtn) {
        backBtn = document.createElement('button');
        backBtn.id = 'back-to-models-btn';
        backBtn.className = 'mb-4 px-5 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition-colors shadow-lg';
        backBtn.innerHTML = '<i class="fas fa-arrow-left mr-2"></i> Quay lại So sánh Mô hình';
        backBtn.onclick = () => {
            setupBackButton(false);
            changeTab('train-models'); // Trở lại tab Mô hình
        };
        // Chèn nút lên trên cái bảng
        const wrapper = document.querySelector('.table-wrapper');
        wrapper.parentNode.insertBefore(backBtn, wrapper);
    }
    backBtn.style.display = show ? 'inline-block' : 'none';
}
function renderModelCards(data) {
    const container = document.getElementById('table-container');

    // 1. Tạm ẩn bảng dữ liệu (không xóa để tránh lỗi DOM khi switch qua lại các tab)
    const table = container.querySelector('table');
    if (table) table.style.display = 'none';

    // 2. Xóa giao diện cards cũ nếu tồn tại
    const oldCards = document.getElementById('model-cards-wrapper');
    if (oldCards) oldCards.remove();

    // 3. Render giao diện Thẻ so sánh
    let htmlContent = `<div id="model-cards-wrapper" class="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">`;

    data.forEach(model => {
        let borderColor = model.accuracy > 85 ? 'border-emerald-500' : 'border-blue-500';

        htmlContent += `
            <div onclick="viewModelErrors('${model.model_name}')" 
                 class="bg-slate-800 rounded-xl p-6 border-t-4 ${borderColor} shadow-lg hover:transform hover:-translate-y-1 transition-all cursor-pointer">
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
            </div>
        `;
    });

    htmlContent += `</div>`;
    container.insertAdjacentHTML('beforeend', htmlContent);
}

// ==========================================
// CÁC HÀM XỬ LÝ GIAO DIỆN BẢNG VÀ PHÂN TRANG
// ==========================================

function renderTable() {
    // === PHẦN MỚI THÊM: Xử lý hiển thị lại Bảng nếu người dùng chuyển từ Tab Mô hình về ===
    const tableContainer = document.getElementById('table-container');
    const table = tableContainer.querySelector('table');
    if (table) table.style.display = 'table'; // Hiển thị lại thẻ table

    const modelCards = document.getElementById('model-cards-wrapper');
    if (modelCards) modelCards.remove(); // Dọn dẹp thẻ mô hình
    // =====================================================================================

    const headerRow = document.getElementById('table-header');
    const bodyRow = document.getElementById('table-body');
    const paginationControls = document.getElementById('pagination-controls');

    if (!globalData || globalData.length === 0) {
        bodyRow.innerHTML = "<tr><td colspan='10' class='p-20 text-center text-slate-500'>Không tìm thấy dữ liệu.</td></tr>";
        if (paginationControls) paginationControls.classList.add('hidden');
        return;
    }

    // TÍNH TOÁN PHÂN TRANG
    const totalPages = Math.ceil(globalData.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedData = globalData.slice(startIndex, endIndex); // Lấy đúng 50 dòng của trang hiện tại

    const columnMapping = {
        "target": "Cảm xúc",
        "id": "Mã ID",
        "date": "Thời gian",
        "flag": "Flag",
        "user": "Người dùng",
        "text": "Nội dung Tweet"
    };

    const columns = Object.keys(globalData[0]).filter(col => col !== 'needs_processing');

    // Vẽ Header
    headerRow.innerHTML = `<tr>${columns.map(col => `
        <th class="px-6 py-4 font-bold text-[11px] uppercase tracking-wider border-b border-slate-600">
            ${columnMapping[col] || col}
        </th>`).join('')}</tr>`;

    // Vẽ Body (Chỉ dùng paginatedData)
    bodyRow.innerHTML = paginatedData.map(item => {
        const isDirty = item.needs_processing === true;
        const rowBg = isDirty ? 'bg-red-500/10' : 'hover:bg-blue-500/5';

        // Escape dấu nháy đơn để không làm hỏng thuộc tính onclick
        const escapedText = item.text ? item.text.replace(/'/g, "\\'") : "";

        return `
    <tr onclick="showProbDetails('${escapedText}')" 
        class="transition-colors group border-b border-slate-800 ${rowBg} cursor-pointer hover:bg-blue-600/10">
        ${columns.map(col => {
            const value = item[col];
            const isLongText = col === 'text' || col === 'C6';

            let textColor = 'text-slate-400';

            if (typeof value === 'number') {
                textColor = 'font-mono text-emerald-400';
            }

            if (col.toLowerCase() === 'predicted') {
                textColor = 'font-mono text-red-500 font-bold';
            }

            if (isDirty && isLongText) {
                textColor = 'text-red-400 font-medium';
            }

            return `
                <td class="px-6 py-4 text-sm ${isLongText ? 'max-w-md truncate' : 'whitespace-nowrap'} ${textColor}">
                    ${value}
                </td>
            `;
        }).join('')}
    </tr>
`}).join('');

    // Hiển thị và vẽ nút Phân trang
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
            <button onclick="prevPage()" class="px-4 py-2 bg-[#334155] hover:bg-[#475569] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left mr-1"></i> Trước
            </button>
            <button onclick="nextPage(${totalPages})" class="px-4 py-2 bg-[#334155] hover:bg-[#475569] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${currentPage === totalPages ? 'disabled' : ''}>
                Sau <i class="fas fa-chevron-right ml-1"></i>
            </button>
        </div>
    `;
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
}

function nextPage(totalPages) {
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
    }
}

// Hiển thị kết quả tính toán của những mẫu bị sai
async function showProbDetails(text) {
    if (currentMode !== 'errors') return;

    const modal = document.getElementById('prob-modal');
    const content = document.getElementById('modal-content');

    modal.classList.remove('hidden');
    content.innerHTML = `
        <div class="text-center py-20">
            <div class="loader mb-4 mx-auto"></div>
            <p class="text-blue-400 font-medium">Đang trích xuất dữ liệu xác suất...</p>
        </div>`;

    try {
        const res = await fetch(`${API_BASE}/model-details?text=${encodeURIComponent(text)}`);
        const result = await res.json();

        if (result.status === "success") {
            const data = result.data;
            const labels = Object.keys(data);
            const words = data[labels[0]].word_steps.map(s => s.word);

            // Tính toán phần trăm độ tin cậy để tránh hiển thị số mũ cực nhỏ
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
                const winner = p0 > p4 ? "Nhãn 0" : "Nhãn 4";
                const winnerColor = p0 > p4 ? "text-rose-400" : "text-emerald-400";

                html += `
                    <tr class="hover:bg-slate-700/20 transition-colors">
                        <td class="px-6 py-4 text-white font-medium">${word}</td>
                        <td class="px-6 py-4 font-mono text-center ${p0 > p4 ? 'text-rose-400 font-bold' : 'text-slate-500'}">${p0.toFixed(6)}</td>
                        <td class="px-6 py-4 font-mono text-center ${p4 > p0 ? 'text-emerald-400 font-bold' : 'text-slate-500'}">${p4.toFixed(6)}</td>
                        <td class="px-6 py-4 text-center">
                            <span class="px-2 py-1 rounded text-[10px] font-bold bg-slate-700/50 ${winnerColor}">${winner}</span>
                        </td>
                    </tr>`;
            });

            html += `</tbody></table></div>`;

            // Cập nhật hiển thị Card với Phần trăm và Thanh tiến trình
            html += `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="relative p-6 rounded-2xl border ${s0 > s4 ? 'border-rose-500 bg-rose-500/10' : 'border-slate-700 bg-slate-800/40'}">
                        ${s0 > s4 ? '<span class="absolute -top-3 left-6 px-3 py-1 bg-rose-500 text-white text-[10px] font-black rounded-full uppercase">Mô hình chọn</span>' : ''}
                        <div class="flex justify-between items-center mb-4">
                            <div>
                                <h4 class="text-rose-400 font-black text-xs uppercase tracking-widest">Tiêu cực (Label 0)</h4>
                                <p class="text-slate-500 text-[10px] mt-1 italic">Xác suất tiên nghiệm: ${data["0"].prior.toFixed(4)}</p>
                            </div>
                            <span class="text-white font-mono font-bold text-xl">${conf0.toFixed(2)}%</span>
                        </div>
                        
                        <div class="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
                            <div class="bg-rose-500 h-full transition-all duration-500" style="width: ${conf0}%"></div>
                        </div>
                        <div class="text-[10px] text-slate-500 font-mono">Raw: ${s0.toExponential(2)}</div>
                    </div>

                    <div class="relative p-6 rounded-2xl border ${s4 > s0 ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-800/40'}">
                        ${s4 > s0 ? '<span class="absolute -top-3 left-6 px-3 py-1 bg-emerald-500 text-white text-[10px] font-black rounded-full uppercase">Mô hình chọn</span>' : ''}
                        <div class="flex justify-between items-center mb-4">
                            <div>
                                <h4 class="text-emerald-400 font-black text-xs uppercase tracking-widest">Tích cực (Label 4)</h4>
                                <p class="text-slate-500 text-[10px] mt-1 italic">Xác suất tiên nghiệm: ${data["4"].prior.toFixed(4)}</p>
                            </div>
                            <span class="text-white font-mono font-bold text-xl">${conf4.toFixed(2)}%</span>
                        </div>
                        
                        <div class="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
                            <div class="bg-emerald-500 h-full transition-all duration-500" style="width: ${conf4}%"></div>
                        </div>
                        <div class="text-[10px] text-slate-500 font-mono">Raw: ${s4.toExponential(2)}</div>
                    </div>
                </div>

                <div class="mt-8 pt-6 border-t border-slate-700 flex items-center justify-center gap-3">
                    <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    <p class="text-slate-400 text-xs italic">Kết luận: Thuật toán chọn nhãn có Độ tin cậy cao hơn sau khi chuẩn hóa kết quả nhân Naive Bayes.</p>
                </div>
            `;

            content.innerHTML = html;
        }
    } catch (error) {
        console.error("Modal Error:", error);
        content.innerHTML = `<div class="p-10 text-center text-rose-400 font-bold">Lỗi kết nối Backend hoặc dữ liệu không tồn tại!</div>`;
    }
}

function closeModal() {
    document.getElementById('prob-modal').classList.add('hidden');
}

function renderModelStudyChart(type) {
    const container = document.getElementById('table-container');
    const loading = document.getElementById('loading');
    // 1. Lấy thêm phần tử điều khiển phân trang
    const paginationControls = document.getElementById('pagination-controls');

    // 2. Ẩn loading và ẨN CẢ THANH PHÂN TRANG
    if (loading) loading.classList.add('hidden');
    if (paginationControls) paginationControls.classList.add('hidden'); // Dòng quan trọng để xóa thanh bên dưới
    
    container.classList.remove('opacity-20');

    const titles = {
        'mnb': "Laplace smoothing - Multinomial Naive Bayes",
        'svm': "Gamma & C - Support Vector Machine",
        'xgb': "Max Depth - XGBoost Classifier"
    };

    container.innerHTML = `
        <div class="p-8 flex flex-col items-center bg-slate-800/30 rounded-2xl border border-slate-700">
            <div class="flex gap-4 mb-8 bg-slate-900/50 p-1 rounded-xl border border-slate-700">
                <button onclick="renderModelStudyChart('mnb')" class="px-4 py-2 rounded-lg text-sm ${type === 'mnb' ? 'bg-blue-600 text-white' : 'text-slate-400'}">MNB</button>
                <button onclick="renderModelStudyChart('svm')" class="px-4 py-2 rounded-lg text-sm ${type === 'svm' ? 'bg-blue-600 text-white' : 'text-slate-400'}">SVM</button>
                <button onclick="renderModelStudyChart('xgb')" class="px-4 py-2 rounded-lg text-sm ${type === 'xgb' ? 'bg-blue-600 text-white' : 'text-slate-400'}">XGBoost</button>
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
}

// Khi tải trang xong sẽ mặc định gọi Tab Xem dữ liệu thô
window.onload = () => changeTab('view-data');