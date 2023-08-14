import fetch from "node-fetch";

export async function getKucoinTokenPrice(pair) {
    const url = `https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${pair}`;
    try {
        let response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        let data = await response.json();
        if (data && data.data && data.data.price) {
            return parseFloat(data.data.price);
        } else {
            throw new Error('Price data not found in API response.');
        }
    } catch (error) {
        console.error("Error fetching KuCoin token price:", error);
        return null;
    }
}


