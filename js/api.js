/**
 *
 * @returns {Promise<boolean>}
 */
let queryMyOrderNotCompleted = async () => {
    let ret = await fetch("https://kyfw.12306.cn/otn/queryOrder/queryMyOrderNoComplete", {
        "credentials": "include",
        "headers": {
            "accept": "application/json, text/javascript, */*; q=0.01",
            "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-requested-with": "XMLHttpRequest"
        },
        "referrer": "https://kyfw.12306.cn/otn/view/train_order.html",
        "referrerPolicy": "no-referrer-when-downgrade",
        "body": "_json_att=",
        "method": "POST",
        "mode": "cors"
    }).then(value => {
        if (value.ok) {
            if (value.redirected === false) {
                return value.json();
            } else {
                return value.text();
            }
        } else {
            console.log("queryMyOrderNotCompleted: failed to query");
            return
        }
    });

    //{"validateMessagesShowId":"_validatorMessage","status":true,"httpstatus":200,"messages":[],"validateMessages":{}}
    if (ret["status"] === true) {
        return true;
    } else {
        console.log("queryMyOrderNotCompleted: failed");
        return false;
    }
}

/**
 * 查询单程票信息
 * @returns Promise<{}>
 * map: {"repeatSubmitToken": string, "leftTicketStr": string,
 * "purposeCodes": string, "trainLocation": string, "keyCheckIsChange": string}
 */
let getDcTicketInfoForPassenger = async () => {
    let resp = await fetch("https://kyfw.12306.cn/otn/confirmPassenger/initDc", {
        "credentials": "include",
        "headers": {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:84.0) Gecko/20100101 Firefox/84.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
            "Content-Type": "application/x-www-form-urlencoded",
            "Upgrade-Insecure-Requests": "1"
        },
        "referrer": "https://kyfw.12306.cn/otn/leftTicket/init?linktypeid=dc",
        "body": "_json_att=",
        "method": "POST",
        "mode": "cors"
    }).then(value => {
        if (value.ok && value.redirected === false) {
            return value.text()
        } else {
            console.log("call /otn/confirmPassenger/initDc.html failed: ", value.error())
            console.error("call /otn/confirmPassenger/initDc.html failed")
        }
    });
    //console.log(resp)
    let startPos = resp.indexOf("globalRepeatSubmitToken");
    let endPos = startPos;
    for (let i = startPos; i < startPos + 100; i++) {
        if (resp[i] === ";") {
            endPos = i;
            break;
        }
    }
    let tokenLine = resp.substring(startPos, endPos); // endPos will not be included
    let token = tokenLine.split("=")[1]
        .replace(/'/g, "").trim();
    console.log("token=" + token);

    startPos = resp.indexOf("ticketInfoForPassengerForm");
    if (startPos === -1) {
        alert("initDc api error, cannot find ticketInfoForPassengerForm in response");
        return {};
    }
    endPos = startPos;
    for (let i = startPos; i < startPos + 10000; i++) {
        if (resp[i] === ";") {
            endPos = i;
            break;
        }
    }
    let ticketInfoForPassengerFormLine = resp.substring(startPos, endPos);
    let ticketInfoForPassengerFormMap = JSON.parse(ticketInfoForPassengerFormLine.split("=")[1]
        .replace(/'/g, "\""));
    console.info(ticketInfoForPassengerFormMap)

    let ticketInfoForPassenger = {
        "keyCheckIsChange": ticketInfoForPassengerFormMap["key_check_isChange"],
        "leftTicketStr": ticketInfoForPassengerFormMap["leftTicketStr"],
        "trainLocation": ticketInfoForPassengerFormMap["train_location"],
        "purposeCodes": ticketInfoForPassengerFormMap["queryLeftTicketRequestDTO"]["purpose_codes"],
        "repeatSubmitToken": token
    }

    console.log("ticketInfoForPassenger: ", ticketInfoForPassenger)

    return ticketInfoForPassenger;
}

/**
 * 查询余票
 * @param trainDate  2020-09-29
 * @param fromStation HZH
 * @param toStation  CQW
 * @param retryCnt 查询余票失败重试次数 默认3次
 * @param retryInterval 重试间隔 默认3s
 * @param purposeCodes ADULT 成人票还是学生票
 * @returns {Promise<{}>}
 * trainTicketsRetMap: {"result":["qNSaHl9hMd%2FNY1s0f...|20200929|3|H2|01|18|1|
 * 0|||||||无||||无|有|||O0M0W0|OMO|0|1||O057350000M091700021O057353000||||||1|",..],"flag":"1",
 * "map":{"CXW":"重庆西","CUW":"重庆北","HZH":"杭州","HGH":"杭州东","XHH":"杭州南"}}
 */
let queryLeftTicket = async (trainDate, fromStation, toStation, retryCnt = 3, retryInterval = 3000,
                             purposeCodes = "ADULT") => {
    if (retryCnt <= 0) {
        console.log("查询余票失败");
        return {};
    }
    let params = `leftTicketDTO.train_date=${trainDate}&leftTicketDTO.from_station=${fromStation}` +
        `&leftTicketDTO.to_station=${toStation}&purpose_codes=${purposeCodes}`;
    // {"httpstatus": 200, "data": {}, "messages":"","status":true}}}
    let ret = await fetch(`https://kyfw.12306.cn/otn/leftTicket/queryT?${params}`, {
        "credentials": "include",
        "headers": {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
            "cache-control": "no-cache",
            "if-modified-since": "0",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-requested-with": "XMLHttpRequest"
        },
        "referrer": `https://kyfw.12306.cn/otn/leftTicket/init?random=${new Date().getTime()}`,
        "referrerPolicy": "no-referrer-when-downgrade",
        "body": null,
        "method": "GET",
        "mode": "cors"
    }).then(value => {
        console.log(value)
        if (value.ok && value.redirected === false) {
            return value.json();
        } else {
            console.error("query left ticket failed: " + value.url);
            return {"status": false};
        }
    });

    if (ret["status"] === true) {
        return ret["data"];
    } else {
        console.error("query left ticket failed, retry..");
        //setTimeout(queryLeftTicket, retryInterval, trainDate, fromStation, toStation, retryCnt - 1);
        //await waitAndRetry(queryLeftTicket, retryInterval, trainDate, fromStation, toStation, retryCnt - 1)
        await new Promise(() => setTimeout(queryLeftTicket, retryInterval, trainDate,
            fromStation, toStation, retryCnt - 1))
    }
}

/**
 * 提交订单
 * @param secretStr "qNSaHl9hMd%2FNY1s0f..." 来自查票接口返回列车信息中第一个字段，每次查询都会不同
 * @param trainDate 2020-09-29  出发日期
 * @param backTrainDate 2020-10-06 回程日期
 * @param fromStationName 杭州 出发站名
 * @param toStationName 重庆  目的站名
 * @param tourFlag dc - 单程， wc - 往返
 * @param purposeCodes ADULT - 成人， 0X00 - 学生
 * @returns {Promise<Response>}
 * {"validateMessagesShowId":"_validatorMessage","status":true,
 * "httpstatus":200,"data":"N","messages":[],"validateMessages":{}}
 */
let submitOrderRequest = async (secretStr, trainDate, backTrainDate, fromStationName, toStationName, tourFlag = "dc",
                                purposeCodes = "ADULT") => {
    let body = `secretStr=${secretStr}&train_date=${trainDate}&back_train_date=${backTrainDate}&` +
        `tour_flag=${tourFlag}&purpose_codes=${purposeCodes}&query_from_station_name=${fromStationName}` +
        `&query_to_station_name=${toStationName}&undefined`;
    console.log("submitOrderRequest body: ", body)

    return await fetch("https://kyfw.12306.cn/otn/leftTicket/submitOrderRequest", {
        "credentials": "include",
        "headers": {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:80.0) Gecko/20100101 Firefox/80.0",
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest"
        },
        "referrer": "https://kyfw.12306.cn/otn/leftTicket/init?linktypeid=dc",
        "body": body,
        "method": "POST",
        "mode": "cors"
    }).then(value => {
        if (value.ok) {
            return value.json();
        } else {
            console.log("submit order failed: " + value.error());
            console.error("submit order failed");
        }
    });
}

/**
 * 查询所有已添加的乘客信息，用于选择乘车乘客
 * @param repeatSubmitToken e5c94ff235354551d16ecee352f924ad, 通过getRepeatSubmitToken()获取
 * @returns {Promise<[]>}
 * [{"passenger_name":"刘旭","sex_code":"M","sex_name":"男",
 * "born_date":"1991-06-23 00:00:00","country_code":"CN",
 * "passenger_id_type_code":"1","passenger_id_type_name":"中国居民身份证",
 * "passenger_id_no":"5113***********213","passenger_type":"3",
 * "passenger_flag":"0","passenger_type_name":"学生",
 * "mobile_no":"182****7089","phone_no":"","email":"lx1848@126.com","address":"",
 * "postalcode":"","first_letter":"","recordCount":"10","total_times":"99","index_id":"0",
 * "allEncStr":"4b794e3fad154744f8c12d92aa9c054c774a8bbd5c04be915bb7f3c446ae625bab84b2777946beb7180143bc7bec5d0362a14dacd096c8023c9be802e391ba6c40e32866c0455252b269ec0af721c63b",
 * "isAdult":"Y", "isYongThan10":"N","isYongThan14":"N","isOldThan60":"N","if_receive":"Y","is_active":"Y",
 * "is_buy_ticket":"N","last_time":"20170120","mobile_check_time":"",
 * "email_active_time":"","last_update_time":"","passenger_uuid":"7d7714874093d59659893535a05c5bf701ca6c04da274f92166578f888dbb2f8","gat_born_date":"",
 * "gat_valid_date_start":"","gat_valid_date_end":"","gat_version":""},...]
 */
let getPassengersInfo = async (repeatSubmitToken) => {

    //{"validateMessagesShowId":"_validatorMessage","status":true,"httpstatus":200,
    // "data":{"notify_for_gat":"","isExist":true,"exMsg":"","two_isOpenClick":["93","95","97","99"],
    //"other_isOpenClick":["91","93","98","99","95","97"], "normal_passengers": [p1,p2,p3...],
    //"dj_passengers":[]},"messages":[],"validateMessages":{}}
    let ret = await fetch("https://kyfw.12306.cn/otn/confirmPassenger/getPassengerDTOs", {
        "credentials": "include",
        "headers": {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:80.0) Gecko/20100101 Firefox/80.0",
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest"
        },
        "referrer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc",
        "body": `_json_att=&REPEAT_SUBMIT_TOKEN=${repeatSubmitToken}`,
        "method": "POST",
        "mode": "cors"
    }).then(value => {
        if (value.ok) {
            return value.json();
        } else {
            console.log("get passenger failed: " + value.error());
            console.error("get passenger failed");
        }
    });

    if (ret["status"] === true && ret["messages"].length === 0) {
        return ret["data"]["normal_passengers"];
    } else {
        console.error("get normal passengers list failed: " + JSON.stringify(ret["messages"]));
        return [];
    }
}
/**
 * 前面排队人数
 * @param trainDate 2021-01-11 transfer to (Tue Sep 29 2020 00:00:00 GMT+0800 (中国标准时间))
 * @param trainNo 56000K115200  班次id
 * @param stationTrainCode K1152 班次
 * @param seatType 1
 * @param fromStation HZH
 * @param toStation CXW
 * @param leftTicket bP2rrfeOWXeRkF%2Fh%2FjQr2ouIfDueVsIbjwrIXdDXDnpdKVziqYwp20JyFQ0%3D
 * @param purposeCodes 00
 * @param trainLocation H6
 * @param repeatSubmitToken e5c94ff235354551d16ecee352f924ad
 * @returns {Promise<void>} {"validateMessagesShowId":"_validatorMessage","status":true,"httpstatus":200,
 * "data":{"count":"7","ticket":"493,0","op_2":"false","countT":"0","op_1":"true"},"messages":[],"validateMessages":{}}

 */
let getQueueCount = async (repeatSubmitToken, trainDate, trainNo, stationTrainCode, seatType, fromStation,
                           toStation, leftTicket, purposeCodes, trainLocation) => {
    let body = `train_date=${encodeURIComponent(new Date(trainDate).toString())}&train_no=${trainNo}&stationTrainCode=${stationTrainCode}&seatType=${seatType}` +
        `&fromStationTelecode=${fromStation}&toStationTelecode=${toStation}&leftTicket=${leftTicket}` +
        `&purpose_codes=${purposeCodes}&train_location=${trainLocation}&_json_att=&REPEAT_SUBMIT_TOKEN=${repeatSubmitToken}`
    console.log("getQueueCount body: ", body)

    return await fetch("https://kyfw.12306.cn/otn/confirmPassenger/getQueueCount", {
        "credentials": "include",
        "headers": {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:80.0) Gecko/20100101 Firefox/80.0",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest"
        },
        "referrer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc",
        "body": body,
        "method": "POST",
        "mode": "cors"
    }).then(value => {
        if (value.ok) {
            return value.json();
        } else {
            console.log("get queue count for this train failed: " + value.error())
            console.error("get queue count for this train failed")
        }
    });
}

/**
 *
 * @param repeatSubmitToken e5c94ff235354551d16ecee352f924ad
 * @param passengerTicketStr 1,0,1,刘旭,1,5113***********213,182****7089,N,4b794e3fad154744f8c12d92aa9c054c774a8bbd5c04be915bb7f3c446ae625bab84b2777946beb7180143bc7bec5d0362a14dacd096c8023c9be802e391ba6c40e32866c0455252b269ec0af721c63b
 * @param oldPassengerStr  刘旭,1,5113***********213,3_
 * @param tourFlag dc
 * @param whatsSelect 1
 * @returns {Promise<boolean>} true 表示成功
 * {"validateMessagesShowId":"_validatorMessage","status":true,"httpstatus":200,
 * "data":{"canChooseBeds":"N","canChooseSeats":"N","choose_Seats":"MOP9Q","isCanChooseMid":"N",
 * "ifShowPassCodeTime":"1","submitStatus":true,"smokeStr":""},"messages":[],"validateMessages":{}}
 */
let checkOrderInfo = async (repeatSubmitToken, passengerTicketStr, oldPassengerStr,
                            tourFlag = "dc", whatsSelect = "1") => {
    let body = `cancel_flag=2&bed_level_order_num=000000000000000000000000000000&passengerTicketStr=${encodeURIComponent(passengerTicketStr)}` +
        `&oldPassengerStr=${encodeURIComponent(oldPassengerStr)}&tour_flag=${tourFlag}&randCode=&whatsSelect=${whatsSelect}&sessionId=&sig=&scene=nc_login` +
        `&_json_att=&REPEAT_SUBMIT_TOKEN=${repeatSubmitToken}`

    let ret = await fetch("https://kyfw.12306.cn/otn/confirmPassenger/checkOrderInfo", {
        "credentials": "include",
        "headers": {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:80.0) Gecko/20100101 Firefox/80.0",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest"
        },
        "referrer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc",
        "body": body,
        "method": "POST",
        "mode": "cors"
    }).then(value => {
        if (value.ok) {
            return value.json();
        } else {
            console.log("checkOrderInfo for passenger %s failed: ", passengerTicketStr, value.error());
            console.error("checkOrderInfo failed");
        }
    });

    if (ret["status"] === true) {
        return true;
    } else {
        console.error("checkOrderInfo failed: " + JSON.stringify(ret["messages"]));
        return false;
    }
}

/**
 * 确认订单
 * @param passengerTicketStr 1,0,1,刘旭,1,5113***********213,182****7089,N,4b794e3fad154744f8c12d92aa9c054c774a8bbd5c04be915bb7f3c446ae625bab84b2777946beb7180143bc7bec5d0362a14dacd096c8023c9be802e391ba6c40e32866c0455252b269ec0af721c63b
 * @param oldPassengerStr 刘旭,1,5113***********213,3_
 * @param purposeCodes 00
 * @param keyCheckIsChange E9CBAC428A2620FB072516147CEAB63AC392059B0B1FE022FC50B74F
 * @param leftTicketStr bP2rrfeOWXeRkF%2Fh%2FjQr2ouIfDueVsIbjwrIXdDXDnpdKVziqYwp20JyFQ0%3D
 * @param trainLocation H6
 * @param seatDetailType  000
 * @param isJy=N 静音车厢, 用默认值N, 因为页面一般不可选
 * @param encryptedData=xxx window.json_ua.toString()
 * @param whatsSelect 1
 * @param roomType 00
 * @param repeatSubmitToken e5c94ff235354551d16ecee352f924ad
 * @returns {Promise<boolean>}
 */
let confirmSingleForQueue = async (repeatSubmitToken, passengerTicketStr, oldPassengerStr, keyCheckIsChange, leftTicketStr,
                                   trainLocation, purposeCodes = "00", seatDetailType = "", isJy = "N",
                                   encryptedData = "", whatsSelect = "1", roomType = "00") => {
    /*
    {
       'passengerTicketStr': '1,0,1,王建会,1,5129***********921,134****0679,N,ac1b75b8790305815e7205fad734f554643142d77df82bc0478cbf688f9fbe92da55590b265d68237d925ddd55517dba0aad4e1a0cc63    10593b84e4bc80f599ad0796f5baba974f5da04069be9bbcc58',
       'oldPassengerStr': '王建会,1,5129***********921,1_',
       'purpose_codes': '00',
       'key_check_isChange': 'D6373EF64F619F2AF445E2032619D92470    7D26DA40DDCBD8A14F7170',
       'leftTicketStr': 'mEB3lPcDpye7AY38Uls%2FmVdRkL0kN2ChIMIAFv3RkVGhzg4j4RI%2BsHbtrg8%3D',
       'train_location': 'H6',
       'seatDetailType': '',
       'roomType': '00',
       'dwAll': 'N    ',
       'whatsSelect': 1,
       '_json_att': '',
       'randCode': '',
       'choose_seats': '',
       'REPEAT_SUBMIT_TOKEN': 'ee73ef0584ae442d64a34e739e477536'
   }
    */
    let body = `passengerTicketStr=${encodeURIComponent(passengerTicketStr)}&oldPassengerStr=${encodeURIComponent(oldPassengerStr)}&randCode=` +
        `&purpose_codes=${purposeCodes}&key_check_isChange=${keyCheckIsChange}&leftTicketStr=${leftTicketStr}` +
        `&train_location=${trainLocation}&choose_seats=&seatDetailType=${seatDetailType}` +
        //`is_jy=${isJy}&encryptedData=${window.json_ua.toString()}`
        `&whatsSelect=${whatsSelect}&roomType=${roomType}&dwAll=N&_json_att=` +
        `&REPEAT_SUBMIT_TOKEN=${repeatSubmitToken}`;
    console.log("confirmOrder body: " + body);

    //{"validateMessagesShowId":"_validatorMessage","status":true,"httpstatus":200,
    // "data":{"submitStatus":true},"messages":[],"validateMessages":{}}
    let ret = await fetch("https://kyfw.12306.cn/otn/confirmPassenger/confirmSingleForQueue", {
        "credentials": "include",
        "headers": {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:80.0) Gecko/20100101 Firefox/80.0",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest"
        },
        "referrer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc",
        "body": body,
        "method": "POST",
        "mode": "cors"
    }).then(value => {
        if (value.ok) {
            return value.json();
        } else {
            console.log("confirmOrder for passenger %s failed: ", passengerTicketStr, value.error());
            console.error("confirmOrder failed");
        }
    });

    if (ret["status"] === true && ret["messages"].length === 0) {
        return true;
    } else {
        console.error("checkOrderInfo failed: " + JSON.stringify(ret["messages"]));
        return false;
    }
}

/**
 * 查询下单是否成功
 * @param repeatSubmitToken
 * @param retryCnt 查询重试次数
 * @param retryInterval 重试间隔，默认3s
 * @param tourFlag
 * @returns {Promise<orderId>}
 * {
	"validateMessagesShowId": "_validatorMessage",
	"status": true,
	"httpstatus": 200,
	"data": {
		"queryOrderWaitTimeStatus": true,
		"count": 0,
		"waitTime": -1,
		"requestId": 6750715037459364000,
		"waitCount": 0,
		"tourFlag": "dc",
		"orderId": "E632642204"
	},
	"messages": [],
	"validateMessages": {}
}
 */
let queryOrderWaitTime = async (repeatSubmitToken, retryCnt = 10, retryInterval = 3000, tourFlag = "dc") => {
    if (retryCnt <= 0) {
        console.log("queryOrderWaitTime， 达到最大重试次数");
        return null;
    }
    let paramsUrl = `random=${new Date().getTime()}&tourFlag=${tourFlag}&_json_att=&REPEAT_SUBMIT_TOKEN=${repeatSubmitToken}`
    let ret = await fetch(`https://kyfw.12306.cn/otn/confirmPassenger/queryOrderWaitTime?${paramsUrl}`, {
        "credentials": "include",
        "headers": {
            "accept": "application/json, text/javascript, */*; q=0.01",
            "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-requested-with": "XMLHttpRequest"
        },
        "referrer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc",
        "referrerPolicy": "no-referrer-when-downgrade",
        "body": null,
        "method": "GET",
        "mode": "cors"
    }).then(value => {
        if (value.ok) {
            return value.json();
        } else {
            console.log("queryOrderWaitTime failed: ", value.error());
            console.error("queryOrderWaitTime failed");
        }
    });

    if (ret["status"] === true && !isEmpty(ret["data"]["orderId"])) {
        return ret["data"]["orderId"];
    } else {
        await new Promise(() => setTimeout(queryOrderWaitTime, retryInterval, repeatSubmitToken, retryCnt - 1, retryInterval))
    }
}

async function waitAndRetry(func, timeout, ...arguments) {
    await new Promise(() => setTimeout(func, timeout, ...arguments))
}

/**
 *
 * @param orderSequenceNo E660544459
 * @param repeatSubmitToken 30d832ac9dba13a9e37f0de37d501be9
 * @returns {Promise<Response>}
 */
let resultOrderForDcQueue = async (orderSequenceNo, repeatSubmitToken) => {
    return await fetch("https://kyfw.12306.cn/otn/confirmPassenger/resultOrderForDcQueue", {
        "credentials": "include",
        "headers": {
            "accept": "application/json, text/javascript, */*; q=0.01",
            "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-requested-with": "XMLHttpRequest"
        },
        "referrer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc",
        "referrerPolicy": "no-referrer-when-downgrade",
        "body": `orderSequence_no=${orderSequenceNo}&_json_att=&REPEAT_SUBMIT_TOKEN=${repeatSubmitToken}`,
        "method": "POST",
        "mode": "cors"
    }).then(value => {
        if (value.ok) {
            return value.json();
        } else {
            console.log("resultOrderForDcQueue failed: ", value.error());
            console.error("resultOrderForDcQueue failed");
        }
    });
}

let goToPayPage = async () => {
    return await fetch("https://kyfw.12306.cn/otn//payOrder/init?random=1609490923629", {
        "credentials": "include",
        "headers": {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
            "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
            "cache-control": "max-age=0",
            "content-type": "application/x-www-form-urlencoded",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "same-origin",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1"
        },
        "referrer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc",
        "referrerPolicy": "no-referrer-when-downgrade",
        "body": "_json_att=&REPEAT_SUBMIT_TOKEN=30d832ac9dba13a9e37f0de37d501be9",
        "method": "POST",
        "mode": "cors"
    });
}
