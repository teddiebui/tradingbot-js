$(document).ready(()=>{
	promises = []
	console.log("hello")
	symbols = []
	futures_symbols = []
	klines = {}
	count = 0
	_websocket_count = 0
	websocket = undefined

	STABLE_COINS = ["AUD", "BIDR", "BRL", "EUR", "GBP", "RUB", "TRY", "TUSD", "USDC", "DAI", "IDRT", "UAH", "NGN", "VAI", "USDP", "USDS"]

	

	myPromise = new Promise(resolve=>{
		//GET ALL SYMBOLS
		url = "https://api.binance.com/api/v3/ticker/price";
		ajax(url, (data) => {
			for (i in data) {
				symbol = data[i]['symbol']
				if (symbol.endsWith("USDT") &&
					!symbol.startsWith("DEFI") &&
					!symbol.endsWith("UPUSDT") &&
					!symbol.endsWith("DOWNUSDT") &&
					!symbol.endsWith("BULLUSDT") &&
					!symbol.endsWith("BEARUSDT") &&
					!STABLE_COINS.includes(symbol.replace("USDT",""))
					) {
						symbols.push(symbol)
					}
			}
			console.log("ok done: ", symbols)


			ajax("https://fapi.binance.com/fapi/v1/ticker/price", (data) => {

				for (let i of data) {
					let symbol = i['symbol']
					if (symbols.indexOf(symbol) != -1) {
						futures_symbols.push(symbol)
					}
				}


				console.log("FUTURES SYMBOL DONE:", futures_symbols)
				console.log(futures_symbols.length)



				resolve()

			}, reject)
			

		})
	})

	promises.push(myPromise)

	run_main()

})

function run_main() {
	console.log("MAIN RUN")


	//SECTION 1: set timer

	now = new Date()
	now.setMilliseconds(0)
	now.setSeconds(0)
	_minute = now.getMinutes()
	now.setMinutes(Math.floor(_minute / 15) * 15 + 15)
	future_time = now.getTime()
	remaining_time = now - new Date().getTime() + 3000 //3 seconds buffer


	console.log("next timer: ", new Date(future_time))
	console.log("time remaining: ", remaining_time)

	myTimeout = setTimeout(run_main, remaining_time)
	console.log("myTimeout: ", myTimeout)

	//SECTION 2: STOP WEB SOCKET
	if (websocket == undefined) {
		console.log("websocket not start yet")
	} else {
		websocket.close()
		_websocket_count = 0
		console.log("stoped old websocket")
	}




	//SECTION 3: //GET KLINES FOR EACH SYMBOL

	Promise.all(promises).then(()=>{
		for (let symbol of symbols) {
			let newPromise = new Promise((resolve, reject)=>{
				
				let a = new Date()
				let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=15m&limit=1000`
				ajax(url,(data)=>{
					if (data.length > 499) {
						klines[symbol] = _build_klines_from_array(symbol, data)
					} else {
						//delete symbols
						symbols.splice(symbols.indexOf(symbol),1)
					}
					
					resolve()
				}, reject)
				
			})
			
			promises.push(newPromise)

			
		}
		
		

	}).then(()=>{
		console.log("GET KLINES DONE")


		//SECTION 4: START NEW WEBSOCKET
		Promise.all(promises).then(()=>{
			console.log(klines)
			websocket = myWebsocket()
			
		})
	})
}

function myWebsocket(callback) {
	let socket = new WebSocket("wss://stream.binance.com:9443/ws/!miniTicker@arr");

	socket.onopen = function(e) {
	};

	socket.onmessage = function(event) {
		data =JSON.parse(event.data)
		if (_websocket_count == 0) {

			//SET UP VARIABLE
			spot = {}
			futures = {}

			//TODO: DO THE CHECKING (EVERY SECOND INTERVAL)
			filtered_data = data.filter((ticker)=> {return ticker['s'].endsWith("USDT")}) 

			for (let ticker of filtered_data) {

				let symbol = ticker['s']
				let kline = klines[symbol]

				//CONTINUE LOOP IF SYMBOL NOT IN LIST
				if (symbols.indexOf(symbol) == -1) continue

				candle = {
					time: ticker['E'],
					open: parseFloat(ticker['o']),
					high: parseFloat(ticker['h']),
					low: parseFloat(ticker['l']),
					close: parseFloat(ticker['c']),
					volume: 0
				}
				
				for (let key in kline) {
					//variable initiation
					last_candle = kline[key][kline[key].length - 1]
					if (spot[key] == undefined) spot[key] = []
					if (futures[key] == undefined) futures[key] = []
					
					//MERGE KLINE
					merge_candle_to_kline(copy(candle), last_candle)

					//CHECK CHANGE
					change = check_change(symbol, last_candle)
					

					if (change) {
						spot[key].push(change)
						if (futures_symbols.indexOf(symbol) != -1) futures[key].push(change)
					}

					
				}
			}
			
			//DISPLAY TO HTML
			console.log("-----SPOT----")	
			for (let key in spot) {
				console.log(spot[key])
				_mdmd(key, "spot", spot[key])
			}
			console.log("-----FUTURES----")
			for (let key in futures) {
				console.log(futures[key])
				_mdmd(key, "futures", futures[key])
			}
		}

		_websocket_count++
		if (_websocket_count == 3) {
			_websocket_count = 0
		}
		
		
		
	};

	socket.onclose = function(event) {
		console.log("close ", event)
	};

	socket.onerror = function(error) {
		console.log(`[error] ${error.message}`);
	};

	return socket
}


function check_change(last_kline) {
	change = (last_kline['close']/last_kline['open']*100 - 100).toFixed(2)
	
	if (change > 5) {
		obj = {}
		obj.symbol = symbol
		obj.change = change

		return obj
	}
}
function merge_candle_to_kline(kline, last_candle) {
	last_candle['high'] = kline.close > last_candle['high'] ? kline.close : last_candle['high']
	last_candle['low'] = kline.close < last_candle['low'] ? kline.close : last_candle['low']
	last_candle['close'] = kline.close
}

function _mdmd(timeframe, market, a_list) {
	$(`#${market} .${timeframe} .table-body`).html("");

	a_list.forEach((element)=> {
		html = "" +
		'<div class="table-row">' +
		`<div class="symbol w-50"> ${element.symbol}</div>` +
		`<div class="change w-50"> +${element.change}%</div>` +
		'</div>'
		$(`#${market} .${timeframe} .table-body`).append(html)
	})
}


function ajax(url, resolve, reject) {
	return $.ajax({
		url : url ,
		method : "GET",
		success: (data) => resolve(data),
		error: (msg) => reject(msg)
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
			// add to candle_4h
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

function reject() {
	console.log("failed")
}



		