const testUrls = [
  'https://kbmxxcdetvqamvpdmgxu.supabase.co/storage/v1/object/public/product-images/a1b2c3d4-e5f6-7890-abcd-ef1234567890/f0122969-9fd1-48d0-81ff-16df14e0ba4e.jpg',
  'https://lh3.googleusercontent.com/pw/AP1GczPO3Xu-h8vx2c3dOqqolECBKvoBJ22EzFUtWml5t3z5jY3r6Z8J_f17tOqA0Q6vR4g5d9E6rL3bYjH4bQ1vK4sX7m2yT8uR0aI1wQ3vK7sN2bL9aC4xV6=w600-h600-s-no-gm',
  'https://jdfkuxryqfomtyhfgxut.supabase.co/storage/v1/object/public/product-images/a1b2c3d4-e5f6-7890-abcd-ef1234567890/f0122969-9fd1-48d0-81ff-16df14e0ba4e.jpg'
];

async function check() {
  for (const url of testUrls) {
    try {
      const res = await fetch(url, { method: 'GET' });
      console.log(`Status ${res.status} for ${url.slice(0, 80)}...`);
    } catch (e) {
      console.log(`Error ${e.message} for ${url.slice(0, 80)}...`);
    }
  }
}

check();
