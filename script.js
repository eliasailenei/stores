document.getElementById('date').innerText = new Date().toLocaleDateString('en-GB');

let sectionCount = 0;
let activeSection = null;
let appData = JSON.parse(localStorage.getItem('stockAppData')) || { stores: [] };
let currentStore = null;
let cameraStream = null;
let currentCameraId = null;
let flashlightOn = false;

// Load or create store
function initStore() {
  const index = localStorage.getItem('stockAppSelectedIndex');
  if (index !== null && appData.stores[index]) {
    currentStore = appData.stores[index];
  } else {
    const id = String(appData.stores.length + 1).padStart(3, '0');
    currentStore = { id, name: 'Main', sections: [] };
    appData.stores.push(currentStore);
    localStorage.setItem('stockAppSelectedIndex', appData.stores.length - 1);
    saveToLocal();
  }

  document.getElementById('val').innerText = currentStore.id;
  document.getElementById('store').innerText = currentStore.name;
  loadSections();
}

// Save appData
function saveToLocal() {
  localStorage.setItem('stockAppData', JSON.stringify(appData));
}

// Rename store
function renameStore() {
  const newName = prompt("Change the store name:", currentStore.name);
  if (newName && newName.trim() !== "") {
    currentStore.name = newName.trim();
    document.getElementById('store').innerText = currentStore.name;
    saveToLocal();
  }
}

// Add heading
function addHeading(title = null, items = []) {
  sectionCount++;
  const container = document.getElementById('headingsContainer');

  const section = document.createElement('div');
  section.classList.add('section');
  section.innerHTML = `
    <h3 contenteditable="true" oninput="autoSaveSections()">` + (title || `Heading ${sectionCount}`) + `</h3>
    <table><thead><tr><th>Number</th><th>Quantity</th></tr></thead><tbody></tbody></table>
  `;
  container.appendChild(section);

  const tbody = section.querySelector('tbody');
  activeSection = tbody;

  items.forEach(item => {
    const row = document.createElement('tr');

    const numberCell = document.createElement('td');
    numberCell.contentEditable = true;
    numberCell.innerText = item.number;
    numberCell.addEventListener('focus', setContextSection);
    numberCell.addEventListener('keydown', removeIfEmpty);

    const qtyCell = document.createElement('td');
    qtyCell.contentEditable = true;
    qtyCell.innerText = item.qty;
    qtyCell.addEventListener('focus', setContextSection);
    qtyCell.addEventListener('keydown', removeIfEmpty);

    row.appendChild(numberCell);
    row.appendChild(qtyCell);
    tbody.appendChild(row);
  });

  autoSaveSections();
}

// Save sections
function autoSaveSections() {
  const sections = Array.from(document.querySelectorAll('.section'));
  currentStore.sections = sections.map(section => {
    const title = section.querySelector('h3').innerText.trim();
    const rows = Array.from(section.querySelectorAll('tbody tr'));
    const items = rows.map(row => {
      const cells = row.querySelectorAll('td');
      return {
        number: cells[0]?.innerText.trim() || '',
        qty: cells[1]?.innerText.trim() || ''
      };
    });
    return { title, items };
  });
  saveToLocal();
}

// Load existing sections
function loadSections() {
  currentStore.sections.forEach(section => {
    addHeading(section.title, section.items);
  });
}

// Track which section is active
function setContextSection(e) {
  activeSection = e.target.closest('tbody');
}

// Add stock row
function addStock() {
  if (!activeSection) {
    alert("Click inside any section first.");
    return;
  }

  const row = document.createElement('tr');

  const numberCell = document.createElement('td');
  numberCell.contentEditable = true;
  numberCell.addEventListener('focus', setContextSection);
  numberCell.addEventListener('keydown', removeIfEmpty);
  numberCell.addEventListener('input', autoSaveSections);

  const qtyCell = document.createElement('td');
  qtyCell.contentEditable = true;
  qtyCell.addEventListener('focus', setContextSection);
  qtyCell.addEventListener('keydown', removeIfEmpty);
  qtyCell.addEventListener('input', autoSaveSections);

  row.appendChild(numberCell);
  row.appendChild(qtyCell);
  row.addEventListener('input', autoSaveSections);

  activeSection.appendChild(row);
  autoSaveSections();
}


// Remove row if all cells are empty
function removeIfEmpty(e) {
  const td = e.target;
  const tr = td.parentElement;
  if (e.key === 'Backspace' && td.innerText.trim() === '') {
    const allEmpty = Array.from(tr.children).every(cell => cell.innerText.trim() === '');
    if (allEmpty) {
      tr.remove();
      e.preventDefault();
      autoSaveSections();
    }
  }
}

// Go back to main screen
function backToOtherStock() {
  location.href = 'index.html';
}

// Handle barcode addition
function addStockWithBarcode(barcode) {
  if (!activeSection) {
    alert("Click inside a section first.");
    return;
  }

  let qty = prompt(`Enter quantity for barcode ${barcode}:`, "1");
  qty = qty && !isNaN(qty) && Number(qty) > 0 ? qty.trim() : "1";

  const row = document.createElement('tr');

  const numberCell = document.createElement('td');
  numberCell.contentEditable = true;
  numberCell.innerText = barcode;
  numberCell.addEventListener('focus', setContextSection);
  numberCell.addEventListener('keydown', removeIfEmpty);
  numberCell.addEventListener('input', autoSaveSections);

  const qtyCell = document.createElement('td');
  qtyCell.contentEditable = true;
  qtyCell.innerText = qty;
  qtyCell.addEventListener('focus', setContextSection);
  qtyCell.addEventListener('keydown', removeIfEmpty);
  qtyCell.addEventListener('input', autoSaveSections);

  row.appendChild(numberCell);
  row.appendChild(qtyCell);
  row.addEventListener('input', autoSaveSections);

  activeSection.appendChild(row);
  autoSaveSections();

  // ✅ Fully restart camera & scanner
  resetCamera(true);
}

function resetCamera(restartScanner = true) {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  if (Quagga.initialized) {
    Quagga.stop();
    Quagga.initialized = false;
  }

  startCamera(currentCameraId).then(() => {
    if (restartScanner) {
      Quagga.onDetected(barcodeHandler);
    }
  });
}
// Barcode scanner handler
function barcodeHandler(data) {
  const code = data.codeResult.code;
  const format = data.codeResult.format;

  if (format !== "code_39") return;
  if (!code || code.length < 5 || code.length > 12 || /\D/.test(code)) return;

  const isDuplicate = Array.from(activeSection.querySelectorAll("tr")).some(row => {
    const cell = row.querySelector("td");
    return cell && cell.innerText.trim() === code;
  });

  if (!isDuplicate) {
    console.log(`📦 Barcode added: ${code}`);
    addStockWithBarcode(code);
  } else {
    console.log(`${code} is duplicate`);
  }

  Quagga.offDetected();
  setTimeout(() => Quagga.onDetected(barcodeHandler), 1000);
}

// Start Quagga
function startBarcodeScanner() {
  if (Quagga.initialized) {
    Quagga.stop();
  }

  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: document.querySelector('#cameraFeed'),
      constraints: {
        deviceId: currentCameraId ? { exact: currentCameraId } : undefined,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "environment"
      }
    },
    locator: { patchSize: "medium", halfSample: true },
    locate: true,
    decoder: { readers: ["code_39_reader"] }
  }, err => {
    if (err) {
      console.error(err);
      alert("Barcode scanner failed to start.");
      return;
    }
    Quagga.initialized = true;
    Quagga.start();
    Quagga.onDetected(barcodeHandler);
  });
}

// List available cameras and setup dropdown
async function listCameras() {
  try {
    // Request camera permission up front to access labels on iOS/Safari
    await navigator.mediaDevices.getUserMedia({ video: true });

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    const select = document.getElementById('cameraSelect');
    select.innerHTML = '';

    let defaultDeviceId = null;

    videoDevices.forEach((device) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label;
      select.appendChild(option);

      // Set as default if it's a rear-facing cam
      if (!defaultDeviceId && /back|rear|environment/i.test(device.label)) {
        defaultDeviceId = device.deviceId;
      }
    });

    // If no rear cam found, just pick the first one
    if (!defaultDeviceId && videoDevices.length > 0) {
      defaultDeviceId = videoDevices[0].deviceId;
    }

    if (defaultDeviceId) {
      currentCameraId = defaultDeviceId;
      select.value = currentCameraId;
      select.onchange = () => {
        currentCameraId = select.value;
        startCamera(currentCameraId);
      };
      await startCamera(currentCameraId);
    }

  } catch (err) {
    alert("Error listing cameras: " + err.message);
    console.error(err);
  }
}


// Start camera stream
async function startCamera(deviceId) {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined
      }
    });

    const video = document.getElementById('cameraFeed');
    if (video) {
      video.srcObject = cameraStream;
      video.play();

      // wait for camera to start before scanning
      video.onloadedmetadata = () => {
        startBarcodeScanner();
      };

      // Hide any old error message
      const errBox = document.getElementById('cameraError');
      if (errBox) errBox.style.display = "none";

      // Flashlight logic
      const track = cameraStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.();
      const flashButton = document.getElementById('toggleFlashlight');

      if (flashButton && capabilities?.torch) {
        flashlightOn = false;
        flashButton.innerText = "Turn On Flashlight";
        flashButton.style.display = "inline-block";
        flashButton.onclick = () => toggleTorch(track);
      } else if (flashButton) {
        flashButton.style.display = "none";
      }
    }

  } catch (err) {
    console.warn("Primary camera failed:", err);

    const select = document.getElementById('cameraSelect');
    const lastOption = select?.options?.[select.options.length - 1];

    if (lastOption && deviceId !== lastOption.value) {
      // Try the last camera as fallback
      currentCameraId = lastOption.value;
      select.value = currentCameraId;
      startCamera(currentCameraId); // Retry
    } else {
      const errBox = document.getElementById('cameraError');
      if (errBox) {
        errBox.innerText = "Don't panic! Try switching to a different camera using the dropdown. This usually fixes the feed.";
        errBox.style.display = "block";
      }
    }
  }
}

function toggleTorch(track) {
  flashlightOn = !flashlightOn;
  track.applyConstraints({ advanced: [{ torch: flashlightOn }] });

  const flashButton = document.getElementById('toggleFlashlight');
  if (flashButton) {
    flashButton.innerText = flashlightOn ? "Turn Off Flashlight" : "Turn On Flashlight";
  }
}





// Toggle flashlight


// Initialize
initStore();
listCameras();

// Hook flashlight button
