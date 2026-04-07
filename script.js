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

    // === PHẦN CODE MỚI: Thêm nhánh xử lý cho Tab Huấn luyện Mô hình ===
    } else if (tabName === 'train-models') {
        title.innerText = "Hiệu suất Huấn luyện Mô hình";
        desc.innerText = "So sánh tổng quan 3 thuật toán: Multinomial NB, SVM và XGBoost.";
        if (datasetControls) datasetControls.classList.add('hidden');
        fetchAndRenderModelCards("/train-models");
    // ====================================================================
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
            <div class="bg-slate-800 rounded-xl p-6 border-t-4 ${borderColor} shadow-lg hover:transform hover:-translate-y-1 transition-all">
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

        return `
        <tr class="transition-colors group border-b border-slate-800 ${rowBg}">
            ${columns.map(col => {
                const value = item[col];
                const isLongText = col === 'text' || col === 'C6'; 
                
                let textColor = 'text-slate-400';
                if (typeof value === 'number') textColor = 'font-mono text-emerald-400';
                if (isDirty && isLongText) textColor = 'text-red-400 font-medium';

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

// Khi tải trang xong sẽ mặc định gọi Tab Xem dữ liệu thô
window.onload = () => changeTab('view-data');