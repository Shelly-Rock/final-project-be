async function test() {
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({sub: 10, username: 'secretary_cntt', role: 'SECRETARY'}, 'my_super_secret_jwt_key_12345');
  const res = await fetch('http://localhost:3001/api/v1/scores/transcripts?page=1&limit=20&published=false&includeInProgress=true&facultyId=KHOA_CNTT', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('Returned count:', data.data?.length);
}
test().catch(console.error);
