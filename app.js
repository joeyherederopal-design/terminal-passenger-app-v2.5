// Configuration - REPLACE WITH YOUR GOOGLE APPS SCRIPT URL
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycby8xX1EdQqdD2PEHfQL45wCAPdYARfrBeD9Mfp1A8aeKxkIxy8YmnOwH6pMyAv4qkPy/exec';

// Transport group mappings
const transportGroups = {
    'BUS': ['RORO', 'CHERRY'],
    'SHUTTLE VAN': ['BARAKAH', 'CENTRO', 'PILANDOK', 'RAYANN', 'RECARO', 'RIO TUBA EXP.', 'RUNLEE'],
    'TRICYCLE': ['TODA'],
    'JEEP': ['N/A'],
    'MULTICAB': ['N/A'],
    'FILCAB': ['N/A']
};

// QR Scanner
let html5QrCode = null;
let stream = null;

const qrScannerBtn = document.getElementById('open-qr-scanner');
const cameraBtn = document.getElementById('open-camera');
const closeScannerBtn = document.getElementById('close-scanner');
const scannerContainer = document.getElementById('scanner-container');
const scannerPreview = document.getElementById('scanner-preview');
const capturedImage = document.getElementById('captured-image');
const plateNumberInput = document.getElementById('plate-number');

// Open QR Scanner
qrScannerBtn.addEventListener('click', async () => {
    try {
        scannerContainer.style.display = 'block';
        qrScannerBtn.style.display = 'none';
        cameraBtn.style.display = 'none';
        capturedImage.style.display = 'none';
        
        html5QrCode = new Html5Qrcode("scanner-preview");
        
        await html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 250 },
            (decodedText) => {
                // QR Code detected!
                plateNumberInput.value = decodedText.toUpperCase();
                plateNumberInput.dispatchEvent(new Event('input'));
                
                // Stop scanner
                html5QrCode.stop().then(() => {
                    scannerContainer.style.display = 'none';
                    qrScannerBtn.style.display = 'inline-flex';
                    cameraBtn.style.display = 'inline-flex';
                });
                
                // Auto-populate vehicle info
                autoPopulateVehicleInfo(decodedText);
            }
        );
    } catch (error) {
        alert('Cannot access camera for QR scanning. Please check permissions or enter manually.');
        console.error('QR Scanner error:', error);
        scannerContainer.style.display = 'none';
        qrScannerBtn.style.display = 'inline-flex';
        cameraBtn.style.display = 'inline-flex';
    }
});

// Open regular camera for photo
cameraBtn.addEventListener('click', async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' }
        });
        scannerPreview.srcObject = stream;
        scannerPreview.style.display = 'block';
        scannerContainer.style.display = 'block';
        qrScannerBtn.style.display = 'none';
        cameraBtn.style.display = 'none';
        capturedImage.style.display = 'none';
    } catch (error) {
        alert('Cannot access camera. Please check permissions.');
        console.error('Camera error:', error);
    }
});

// Close scanner
closeScannerBtn.addEventListener('click', () => {
    if (html5QrCode) {
        html5QrCode.stop().catch(err => console.error(err));
    }
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        scannerPreview.srcObject = null;
    }
    scannerPreview.style.display = 'none';
    scannerContainer.style.display = 'none';
    qrScannerBtn.style.display = 'inline-flex';
    cameraBtn.style.display = 'inline-flex';
});

// Auto-populate vehicle info from registry
function autoPopulateVehicleInfo(plateNumber) {
    if (typeof getVehicleInfo !== 'function') return;
    
    const vehicleInfo = getVehicleInfo(plateNumber);
    if (vehicleInfo) {
        // Set denomination
        const denominationSelect = document.getElementById('denomination');
        denominationSelect.value = vehicleInfo.denomination;
        denominationSelect.classList.add('auto-filled');
        denominationSelect.dispatchEvent(new Event('change'));
        
        // Set transport group after denomination is set
        setTimeout(() => {
            const transportGroupSelect = document.getElementById('transport-group');
            transportGroupSelect.value = vehicleInfo.transportGroup;
            transportGroupSelect.classList.add('auto-filled');
        }, 100);
        
        // Show feedback
        const statusMessage = document.getElementById('status-message');
        statusMessage.textContent = '✅ Vehicle info loaded from registry!';
        statusMessage.className = 'status-message status-success';
        statusMessage.style.display = 'block';
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 3000);
    }
}

// Plate number input listener for manual entry
plateNumberInput.addEventListener('input', function() {
    this.value = this.value.toUpperCase();
});

plateNumberInput.addEventListener('blur', function() {
    autoPopulateVehicleInfo(this.value);
});

// Smart Transport Group dropdown
const denominationSelect = document.getElementById('denomination');
const transportGroupSelect = document.getElementById('transport-group');

denominationSelect.addEventListener('change', function() {
    const selectedType = this.value;
    
    // Clear and reset transport group
    transportGroupSelect.innerHTML = '<option value="">Select Transport Group</option>';
    transportGroupSelect.disabled = !selectedType;
    
    if (selectedType && transportGroups[selectedType]) {
        const groups = transportGroups[selectedType];
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group;
            option.textContent = group;
            transportGroupSelect.appendChild(option);
        });
        transportGroupSelect.disabled = false;
    }
});

// SMART ORIGIN/DESTINATION LOGIC
const typeSelect = document.getElementById('type');
const originGroup = document.getElementById('origin-group');
const destinationGroup = document.getElementById('destination-group');
const originSelect = document.getElementById('origin');
const destinationSelect = document.getElementById('destination');

typeSelect.addEventListener('change', function() {
    const type = this.value;
    
    if (type === 'ARRIVAL') {
        // Show ORIGIN only (where did it come from?)
        originGroup.classList.remove('hidden');
        destinationGroup.classList.add('hidden');
        originSelect.required = true;
        destinationSelect.required = false;
        destinationSelect.value = ''; // Clear destination
    } else if (type === 'DEPARTURE') {
        // Show DESTINATION only (where is it going?)
        originGroup.classList.add('hidden');
        destinationGroup.classList.remove('hidden');
        originSelect.required = false;
        destinationSelect.required = true;
        originSelect.value = ''; // Clear origin
    } else {
        // Hide both if no type selected
        originGroup.classList.add('hidden');
        destinationGroup.classList.add('hidden');
        originSelect.required = false;
        destinationSelect.required = false;
    }
});

// Auto-calculate passenger totals
const passengerInputs = document.querySelectorAll('.passenger-count');

function calculateTotals() {
    // Adult totals
    const adultMale = parseInt(document.getElementById('adult-male').value) || 0;
    const adultFemale = parseInt(document.getElementById('adult-female').value) || 0;
    document.getElementById('adult-total').value = adultMale + adultFemale;
    
    // Child totals
    const childMale = parseInt(document.getElementById('child-male').value) || 0;
    const childFemale = parseInt(document.getElementById('child-female').value) || 0;
    document.getElementById('child-total').value = childMale + childFemale;
    
    // Senior totals
    const seniorMale = parseInt(document.getElementById('senior-male').value) || 0;
    const seniorFemale = parseInt(document.getElementById('senior-female').value) || 0;
    document.getElementById('senior-total').value = seniorMale + seniorFemale;
    
    // PWD totals
    const pwdMale = parseInt(document.getElementById('pwd-male').value) || 0;
    const pwdFemale = parseInt(document.getElementById('pwd-female').value) || 0;
    document.getElementById('pwd-total').value = pwdMale + pwdFemale;
    
    // Pregnant
    const pregnant = parseInt(document.getElementById('pregnant').value) || 0;
    
    // Total males and females
    const totalMales = adultMale + childMale + seniorMale + pwdMale;
    const totalFemales = adultFemale + childFemale + seniorFemale + pwdFemale + pregnant;
    
    // Grand total
    const grandTotal = totalMales + totalFemales;
    document.getElementById('total-passengers').textContent = `Total Passengers: ${grandTotal}`;
}

// Add event listeners to all passenger count inputs
passengerInputs.forEach(input => {
    input.addEventListener('input', calculateTotals);
});

// Set default date and time
document.getElementById('trip-date').valueAsDate = new Date();
const now = new Date();
document.getElementById('trip-time').value = now.toTimeString().slice(0, 5);

// Form submission
document.getElementById('passenger-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submit-btn');
    const statusMessage = document.getElementById('status-message');
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Submitting...';
    
    // Determine origin/destination based on type
    const type = document.getElementById('type').value;
    let origin = '';
    let destination = '';
    
    if (type === 'ARRIVAL') {
        origin = document.getElementById('origin').value;
        destination = 'BROOKE\'S POINT'; // Arriving at Brooke's Point
    } else if (type === 'DEPARTURE') {
        origin = 'BROOKE\'S POINT'; // Departing from Brooke's Point
        destination = document.getElementById('destination').value;
    }
    
    // Gather form data
    const formData = {
        tripDate: document.getElementById('trip-date').value,
        tripTime: document.getElementById('trip-time').value,
        type: type,
        denomination: document.getElementById('denomination').value,
        transportGroup: document.getElementById('transport-group').value,
        origin: origin,
        destination: destination,
        plateNumber: document.getElementById('plate-number').value,
        adultMale: parseInt(document.getElementById('adult-male').value) || 0,
        adultFemale: parseInt(document.getElementById('adult-female').value) || 0,
        adultTotal: parseInt(document.getElementById('adult-total').value) || 0,
        childMale: parseInt(document.getElementById('child-male').value) || 0,
        childFemale: parseInt(document.getElementById('child-female').value) || 0,
        childTotal: parseInt(document.getElementById('child-total').value) || 0,
        seniorMale: parseInt(document.getElementById('senior-male').value) || 0,
        seniorFemale: parseInt(document.getElementById('senior-female').value) || 0,
        seniorTotal: parseInt(document.getElementById('senior-total').value) || 0,
        pwdMale: parseInt(document.getElementById('pwd-male').value) || 0,
        pwdFemale: parseInt(document.getElementById('pwd-female').value) || 0,
        pwdTotal: parseInt(document.getElementById('pwd-total').value) || 0,
        pregnant: parseInt(document.getElementById('pregnant').value) || 0,
        totalMales: (parseInt(document.getElementById('adult-male').value) || 0) +
                    (parseInt(document.getElementById('child-male').value) || 0) +
                    (parseInt(document.getElementById('senior-male').value) || 0) +
                    (parseInt(document.getElementById('pwd-male').value) || 0),
        totalFemales: (parseInt(document.getElementById('adult-female').value) || 0) +
                      (parseInt(document.getElementById('child-female').value) || 0) +
                      (parseInt(document.getElementById('senior-female').value) || 0) +
                      (parseInt(document.getElementById('pwd-female').value) || 0) +
                      (parseInt(document.getElementById('pregnant').value) || 0),
        totalPassengers: parseInt(document.getElementById('total-passengers').textContent.split(': ')[1])
    };
    
    try {
        // Send to Google Sheets
        const response = await fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        // Show success message
        statusMessage.textContent = '✅ Data submitted successfully!';
        statusMessage.className = 'status-message status-success';
        statusMessage.style.display = 'block';
        
        // Reset form
        setTimeout(() => {
            document.getElementById('passenger-form').reset();
            document.getElementById('trip-date').valueAsDate = new Date();
            const now = new Date();
            document.getElementById('trip-time').value = now.toTimeString().slice(0, 5);
            calculateTotals();
            capturedImage.style.display = 'none';
            statusMessage.style.display = 'none';
            
            // Hide origin/destination fields
            originGroup.classList.add('hidden');
            destinationGroup.classList.add('hidden');
            
            // Remove auto-filled classes
            document.querySelectorAll('.auto-filled').forEach(el => {
                el.classList.remove('auto-filled');
            });
            
            // Reset transport group dropdown
            transportGroupSelect.innerHTML = '<option value="">First select vehicle type</option>';
            transportGroupSelect.disabled = true;
        }, 2000);
        
    } catch (error) {
        // Show error message
        statusMessage.textContent = '❌ Error submitting data. Please try again.';
        statusMessage.className = 'status-message status-error';
        statusMessage.style.display = 'block';
        console.error('Submit error:', error);
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = '📤 SUBMIT DATA';
    }
});

// Service Worker registration for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Service Worker registered'))
        .catch(err => console.log('Service Worker registration failed'));
}