$(document).ready(()=>{
	promises = []
	console.log("hello")
	symbols = []
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
			resolve()

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
			list_15m = []
			list_1h = []
			list_4h = []

			//TODO: DO THE CHECKING (EVERY SECOND INTERVAL)
			filtered_data = data.filter((ticker)=> {return ticker['s'].endsWith("USDT")}) 

			for (ticker of filtered_data) {

				let symbol = ticker['s']
				eventTime = ticker['E'] //evemt time
				_close = parseFloat(ticker['c'])
				_open = parseFloat(ticker['o'])
				_high = parseFloat(ticker['h'])
				_low  = parseFloat(ticker['l'])
				
				//CONTINUE LOOP IF SYMBOL NOT IN LIST
				if (symbols.indexOf(symbol) == -1) {
					continue
				}

				candle_15m = klines[symbol]['15m']
				candle_1h = klines[symbol]['1h']
				candle_4h = klines[symbol]['4h']

				//MERGE KLINE TO KLINES
				//MERGE KLINE 15M
				kline_15m = klines[symbol]['15m'][klines[symbol]['15m'].length-1]
				kline_15m['high'] = _close > kline_15m['high'] ? _close : kline_15m['high']
				kline_15m['low'] = _close < kline_15m['low'] ? _close : kline_15m['low']
				kline_15m['close'] = _close

				//MERGE KLINE 1h
				kline_1h = klines[symbol]['1h'][klines[symbol]['1h'].length-1]
				kline_1h['high'] = _close > kline_1h['high'] ? _close : kline_1h['high']
				kline_1h['low'] = _close < kline_1h['low'] ? _close : kline_1h['low']
				kline_1h['close'] = _close

				//MERGE KLINE 4h
				kline_4h = klines[symbol]['4h'][klines[symbol]['4h'].length-1]
				kline_4h['high'] = _close > kline_4h['high'] ? _close : kline_4h['high']
				kline_4h['low'] = _close < kline_4h['low'] ? _close : kline_4h['low']
				kline_4h['close'] = _close


				//DO THE LOGIC
				change_15m = (kline_15m['close']/kline_15m['open']*100 - 100).toFixed(2)
				if (change_15m > 5) {
					list_15m.push({
						symbol: symbol,
						change: parseFloat(change_15m)})
				}

				change_1h = (kline_1h['close']/kline_1h['open']*100 - 100).toFixed(2)
				if (change_1h > 5) {
					list_1h.push({
						symbol: symbol,
						change: parseFloat(change_1h)})
				}

				change_4h = (kline_4h['close']/kline_4h['open']*100 - 100).toFixed(2)
				if (change_4h > 5) {
					list_4h.push({
						symbol:symbol,
						change: parseFloat(change_4h)})
				}
			}
			
			//DEBUG
			console.log(klines['BTCUSDT']['15m'][klines['BTCUSDT']['15m'].length-1])
			console.log(list_15m)
			console.log(list_1h)
			console.log(list_4h)
			console.log("------------------")

			//DISPLAY TO HTML

			if (list_15m.length > 0) {
				$("#15m .table-body").html("")

				list_15m.forEach((element)=> {
					html = "" +
					'<div class="table-row">' +
					'<div class="symbol w-50">' + element.symbol +'</div>' +
					'<div class="change w-50">' + element.change +'</div>' +
					'</div>'
					$("#15m .table-body").append(html)
				})
			}

			if (list_1h.length > 0) {
				$("#1h .table-body").html("");

				list_1h.forEach((element)=> {
					html = "" +
					'<div class="table-row">' +
					'<div class="symbol w-50">' + element.symbol +'</div>' +
					'<div class="change w-50">' + element.change +'</div>' +
					'</div>'
					$("#1h .table-body").append(html)
				})
			}

			if (list_4h.length > 0) {
				$("#4h .table-body").html("");

				list_4h.forEach((element)=> {
					html = "" +
					'<div class="table-row">' +
					'<div class="symbol w-50">' + element.symbol +'</div>' +
					'<div class="change w-50">' + element.change +'</div>' +
					'</div>'
					$("#4h .table-body").append(html)
				})
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

function _sub_merge_kline(_close, kline) {

}

function _asdasdasd() {
	for (key in klines) {
		html = "" +
		'<div class="table d-flex flex-column" id="'+ key +'">' + 
		' <div class="table-header">'+ key+'</div>' +
		'<div class="table-body text-center">' + '</div></div>'

		$("#main-body").append(html)

	}
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



		