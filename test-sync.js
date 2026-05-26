import fetch from 'node-fetch';

async function test() {
  const TARGET_SHEET_ID = '1Wq14Vhri5MZoVP7XN-mMQAB9Yh3Ccag6n66_NyLcCsg';
  const TARGET_DRIVE_FOLDER_ID = '1v512TPNJm752mNGSM4GufacyAGn6QlQs';

  const payload = {
    action: 'CREATE',
    id_pkl: '1247',
    nama: 'Test With Photo',
    kelurahan: 'Losari',
    alamat: 'Test Alamat',
    jenis: 'test',
    status: 'Belum Relokasi',
    history: 'Tidak ada catatan',
    fotoBeforeBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    fotoAfterBase64: '',
    targetSheetId: TARGET_SHEET_ID,
    targetFolderId: TARGET_DRIVE_FOLDER_ID
  };

  console.log('Sending payload...');
  const res = await fetch('https://script.google.com/macros/s/AKfycbzNIC_6aoVMICn170I3voOQcZ5bvS1wLdwPR0y2wq7_0q_wi0BxclbII3hdVCX6I3CZ/exec', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text);
}
test();
