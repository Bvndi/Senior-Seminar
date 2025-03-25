//Backend Proxy
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());

app.get('/api/yelp', async (req, res) => {
try {
const { term, location, radius, sort_by } = req.query;
const response = await axios.get('https://api.yelp.com/v3/businesses/search', {
params: { term, location, radius, sort_by },
headers: {
'Authorization': 'Bearer toY0q6whX7_wBO9zdfdkymlgnWCHolOjsUjVtmRnAFcJhwDUC5IMuwwfxFsL8f_onGwrrcg7BMjrZUTLUClp_HmZhGTkKaX-fnezPnMy1OHnKpAhAVUAScIRHYvhZ3Yx'
}
});
res.json(response.data);
} catch (error) {
res.status(500).json({ error: error.message });
}
});

app.listen(3000, () => console.log('Proxy server running on port 3000'));