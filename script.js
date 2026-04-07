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

// ==========================================
// CÁC HÀM XỬ LÝ GIAO DIỆN BẢNG VÀ PHÂN TRANG
// ==========================================

function renderTable() {
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