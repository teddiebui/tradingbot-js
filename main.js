$(document).ready(()=>{
	console.log("hello")
	symbols = []
	klines = {}
	get_symbols()
	
	
	
})


async function get_symbols() {
		url = "https://api.binance.com/api/v3/ticker/price";
		await ajax(url, (data) => {
			for (i in data) {
				symbol = data[i]['symbol']
				if (symbol.endsWith("USDT") &&
					!symbol.endsWith("UPUSDT") &&
					!symbol.endsWith("DOWNUSDT") &&
					!symbol.endsWith("BULLUSDT") &&
					!symbol.endsWith("BEARUSDT")
					) {
						symbols.push(symbol)
					}
			}


			get_klines(symbols)

		})
		
	}

 async function get_klines(symbols) {
		for (i in symbols) {
			a = new Date()
			symbol = symbols[i];
			url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=15m&limit=1000`
			await ajax(url,(data)=>{
				_data = _build_klines_from_array(symbol, data)
				klines[symbol] = _data
				
			})		
			console.log("done", symbols.indexOf(symbol)+1+"/"+symbols.length, symbol, (new Date()-a)/1000)
		}
		console.log(klines)
	}
function ajax(url, callback) {
	$.ajax({
		url : url ,
		method : "GET",
		success: (data) => callback(data),
		error: ()=> console.log("error", error)
	})
}

function _build_klines_from_array(symbol ,raw_klines) {

	candle_15m = !klines[symbol] ? [] : klines[symbol]['15m']
	candle_1h = !klines[symbol] ? [] : klines[symbol]['1h']
	candle_4h = !klines[symbol] ? [] : klines[symbol]['4h']
	
	
	for (each in raw_klines) {
		candle = {
			'time': raw_klines[each][0],
			'open': parseFloat(raw_klines[each][1]),
			'high': parseFloat(raw_klines[each][2]),
			'low': parseFloat(raw_klines[each][3]),
			'close': parseFloat(raw_klines[each][4]),
			'volume': parseFloat(raw_klines[each][5])
		}
		time = parseInt(candle['time'])
		date = new Date(time)
		
		//15m
		candle_15m.push(candle)
		
		//1h
		if (date.getMinutes() == 0) {
			candle_1h.push(copy(candle))
		} else {
			// add to candle_1h
			if (candle_1h.length > 1) {
				_build_merge_kline(candle, candle_1h)
			}
		}

		//4h
		if (date.getMinutes() == 0 && date.getHours() % 4 == 0) {
			candle_4h.push(copy(candle))
		} else {
			// add to candle_1h
			if (candle_4h.length > 1) {
				_build_merge_kline(candle, candle_4h)
			}
		}
		
	}
	
	return {"15m": candle_15m, "1h": candle_1h, "4h": candle_4h}
}

function _build_merge_kline(kline, klines) {
	
	
	klines[klines.length-1]['time'] = kline['time']
	
	if (kline['high'] > klines[klines.length-1]['high']) {
		klines[klines.length-1]['high'] = kline['high']
	}
		
	if (kline['low'] < klines[klines.length-1]['low']) {
		klines[klines.length-1]['low'] = kline['low']
	}
		
	klines[klines.length-1]['close']  = kline['close']
	klines[klines.length-1]['volume']  += kline['volume']

}


function copy(obj) {
	newObj = {}
	
	for (key in obj) {
		newObj[key] = obj[key]
	}
	
	return newObj
}



		