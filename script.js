const API_BASE = "http://127.0.0.1:8000/api";

async function changeTab(tabName) {
    // Cập nhật trạng thái nút
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${tabName}`).classList.add('active');

    const title = document.getElementById('page-title');
    const desc = document.getElementById('page-desc');
    const loading = document.getElementById('loading');
    const container = document.getElementById('table-container');

    // Hiệu ứng Loading
    container.classList.add('opacity-20');
    loading.classList.remove('hidden');

    let endpoint = "/customers";
    if (tabName === 'view-data') {
        title.innerText = "Dữ liệu thô";
        desc.innerText = "Dữ liệu thô từ hệ thống (file csv).";
        endpoint = "/preview-data";
    } else if (tabName === 'view-outliers') {
        title.innerText = "Dữ liệu Ngoại lai (Outliers)";
        desc.innerText = "Các điểm dữ liệu có dấu hiệu bất thường (Z-Score > 3).";
        endpoint = "/outliers";
    } else if (tabName === 'process-outliers') {
        title.innerText = "Dữ liệu đã Xử lý";
        desc.innerText = "Kết quả sau khi loại bỏ nhiễu và chuẩn hóa.";
        endpoint = "/process-outliers";
    }

    try {
        const res = await fetch(`${API_BASE}${endpoint}`);
        const result = await res.json();
        
        if (result.status === "success") {
            setTimeout(() => { // Tạo độ trễ nhẹ cho hiệu ứng loading mượt hơn
                renderTable(result.data);
                loading.classList.add('hidden');
                container.classList.remove('opacity-100');
                container.classList.remove('opacity-20');
            }, 400);
        }
    } catch (error) {
        console.error("Lỗi kết nối:", error);
        loading.innerHTML = '<p class="text-red-500">Lỗi: Không thể kết nối tới Python Backend!</p>';
    }
}

function renderTable(data) {
    const headerRow = document.getElementById('table-header');
    const bodyRow = document.getElementById('table-body');

    if (!data || data.length === 0) {
        bodyRow.innerHTML = "<tr><td colspan='10' class='p-20 text-center text-slate-500'>Không tìm thấy dữ liệu.</td></tr>";
        return;
    }

    // 1. Tạo một bảng "Dịch" tên cột cho thân thiện
    const columnMapping = {
        "target": "Cảm xúc", // C1
        "id": "Mã ID",       // C2
        "date": "Thời gian", // C3
        "flag": "Flag",      // C4
        "user": "Người dùng",// C5
        "text": "Nội dung Tweet" // C6
    };

    const columns = Object.keys(data[0]);

    // 2. Vẽ Header với tên đã dịch (nếu không có trong mapping thì giữ nguyên)
    headerRow.innerHTML = `<tr>${columns.map(col => `
        <th class="px-6 py-4 font-bold text-[11px] uppercase tracking-wider border-b border-slate-600">
            ${columnMapping[col] || col}
        </th>`).join('')}</tr>`;

    // 3. Vẽ Body với logic khống chế độ dài văn bản
    bodyRow.innerHTML = data.map(item => `
        <tr class="hover:bg-blue-500/5 transition-colors group border-b border-slate-800">
            ${columns.map(col => {
                const value = item[col];
                // Nếu là cột 'text' hoặc cột chứa nội dung dài
                const isLongText = col === 'text' || col === 'C6'; 
                
                return `
                    <td class="px-6 py-4 text-sm ${isLongText ? 'max-w-md truncate' : 'whitespace-nowrap'} 
                        ${typeof value === 'number' ? 'font-mono text-emerald-400' : 'text-slate-400'}">
                        ${value}
                    </td>
                `;
            }).join('')}
        </tr>
    `).join('');
}

window.onload = () => changeTab('view-data');