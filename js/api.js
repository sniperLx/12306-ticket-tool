let API = {
    retry: (fn, times, delay, ...args) => {
        return new Promise((resolve, reject) => {
            let errVal;
            let attempt = () => {
                if (times === 0) {
                    reject(errVal);
                } else {
                    fn.apply(fn, args).then(resolve).catch(err => {
                        errVal = err;
                        times--;
                        setTimeout(attempt, delay)
                    })
                }
            }
            attempt();
        });
    },

    url: "kyfw.12306.cn",

    apiHeader: () => {
        return {
            "accept": "application/json, text/javascript, */*; q=0.01",
            "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-requested-with": "XMLHttpRequest"
        };
    },

    keepActive:  async () => {
        let ok = await API.queryMyOrderNotCompleted();
        if (ok) {
            setTimeout(keepActive, 20 * 1000);
        } else {
            console.log("[keepActive], queryMyOrderNotCompleted. 检测到已经退出了12306, 请重新登陆后继续");
            alert("检测到已经退出了12306, 请重新登陆后继续!");
        }
    },

    /**
     *
     * @returns {Promise<boolean>}
     */
    queryMyOrderNotCompleted: async () => {
        let ret = await fetch(`https://${API.url}/otn/queryOrder/queryMyOrderNoComplete`, {
            "credentials": "include",
            "headers": API.apiHeader(),
            "referrer": `https://${API.url}/otn/view/train_order.html`,
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
                console.log("queryMyOrderNotCompleted: failed to query: ", value.error());
                return {"status": false, "messages": "call api failed"}
            }
        });

        //{"validateMessagesShowId":"_validatorMessage","status":true,"httpstatus":200,"messages":[],"validateMessages":{}}
        if (ret["status"] === true) {
            return true;
        } else {
            console.log("queryMyOrderNotCompleted: failed");
            return false;
        }
    },

    initDc: () => {
       return fetch(`https://${API.url}/otn/confirmPassenger/initDc`, {
            "credentials": "include",
            "headers": API.apiHeader(),
            "referrer": `https://${API.url}/otn/leftTicket/init?linktypeid=dc`,
            "body": "_json_att=",
            "method": "POST",
            "mode": "cors"
        }).then(value => {
            if (value.ok && value.redirected === false) {
                return value.text()
            } else {
                console.log("[initDcTicketInfoForPassenger], call /otn/confirmPassenger/initDc.html failed: ", value.error());
                throw new Error("initDc接口调用失败");
            }
        });
    },

    /**
     * 查询余票
     * @param trainDate  2020-09-29
     * @param fromStation HZH
     * @param toStation  CQW
     * @param purposeCodes ADULT 成人票还是学生票
     * @returns {Promise<{}>}
     * trainTicketsRetMap: {"result":["qNSaHl9hMd%2FNY1s0f...|20200929|3|H2|01|18|1|
     * 0|||||||无||||无|有|||O0M0W0|OMO|0|1||O057350000M091700021O057353000||||||1|",..],"flag":"1",
     * "map":{"CXW":"重庆西","CUW":"重庆北","HZH":"杭州","HGH":"杭州东","XHH":"杭州南"}}
     */
    queryLeftTicket: async (trainDate, fromStation, toStation, purposeCodes = "ADULT") => {
        let params = `leftTicketDTO.train_date=${trainDate}&leftTicketDTO.from_station=${fromStation}` +
            `&leftTicketDTO.to_station=${toStation}&purpose_codes=${purposeCodes}`;
        console.log(params)
        // {"httpstatus": 200, "data": {}, "messages":"","status":true}}}
        let ret = await fetch(`https://${API.url}/otn/leftTicket/queryZ?${params}`, {
            "credentials": "include",
            "headers": API.apiHeader(),
            "referrer": `https://${API.url}/otn/leftTicket/init?random=${new Date().getTime()}`,
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
                return {"status": false, "messages": "call api failed"}
            }
        });

        if (ret["status"] === true) {
            return ret["data"];
        } else {
            throw new Error("query left ticket failed");
        }
    },

    /**
     * 提交订单
     * @param secretStr "qNSaHl9hMd%2FNY1s0f..." 来自查票接口返回列车信息中第一个字段，每次查询都会不同
     * @param trainDate 2020-09-29  出发日期
     * @param backTrainDate 2020-10-06 回程日期
     * @param fromStationName 杭州 出发站名
     * @param toStationName 重庆  目的站名
     * @param tourFlag dc - 单程， wc - 往返
     * @param purposeCodes ADULT - 成人， 0X00 - 学生
     * @returns {Promise<boolean>}
     * {"validateMessagesShowId":"_validatorMessage","status":true,
     * "httpstatus":200,"data":"N","messages":[],"validateMessages":{}}
     */
    submitOrderRequest: async (secretStr, trainDate, backTrainDate, fromStationName, toStationName, tourFlag = "dc",
                               purposeCodes = "ADULT") => {
        let body = `secretStr=${secretStr}&train_date=${trainDate}&back_train_date=${backTrainDate}&` +
            `tour_flag=${tourFlag}&purpose_codes=${purposeCodes}&query_from_station_name=${fromStationName}` +
            `&query_to_station_name=${toStationName}&undefined`;
        console.log("[submitOrderRequest] body: ", body)

        let ret = await fetch(`https://${API.url}/otn/leftTicket/submitOrderRequest`, {
            "credentials": "include",
            "headers": API.apiHeader(),
            "referrer": `https://${API.url}/otn/leftTicket/init?linktypeid=dc`,
            "body": body,
            "method": "POST",
            "mode": "cors"
        }).then(value => {
            if (value.ok) {
                if (value.redirected) {
                    return value.url;
                } else {
                    return value.json();
                }
            } else {
                console.log("[submitOrderRequest] api failed: " + value.error());
                console.error("[submitOrderRequest] api failed");
                return {"status": false, "messages": "call api failed"}
            }
        });

        if (ret["status"] === true) {
            return true;
        } else {
            throw new Error(ret["messages"]);
        }
    },

    /**
     * 查询所有已添加的乘客信息，用于选择乘车乘客
     * @param repeatSubmitToken e5c94ff235354551d16ecee352f924ad, 通过getRepeatSubmitToken()获取
     * @returns {Promise<[]>}
     * [{"passenger_name":"xx","sex_code":"M","sex_name":"男",
     * "born_date":"1999-09-23 00:00:00","country_code":"CN",
     * "passenger_id_type_code":"1","passenger_id_type_name":"中国居民身份证",
     * "passenger_id_no":"5124***********213","passenger_type":"3",
     * "passenger_flag":"0","passenger_type_name":"学生",
     * "mobile_no":"182****7129","phone_no":"","email":"xx@126.com","address":"",
     * "postalcode":"","first_letter":"","recordCount":"10","total_times":"99","index_id":"0",
     * "allEncStr":"4b794e3fad154744f8c12d92aa9c054c774a8bbd5c04be915bb7f3c446ae625bab...af721c63b",
     * "isAdult":"Y", "isYongThan10":"N","isYongThan14":"N","isOldThan60":"N","if_receive":"Y","is_active":"Y",
     * "is_buy_ticket":"N","last_time":"20190120","mobile_check_time":"",
     * "email_active_time":"","last_update_time":"","passenger_uuid":"7d7714874093d59659893535a05c5bf701ca6c04da274f92166578f888dbb2f8","gat_born_date":"",
     * "gat_valid_date_start":"","gat_valid_date_end":"","gat_version":""},...]
     */
    getPassengersInfo: async (repeatSubmitToken) => {

        //{"validateMessagesShowId":"_validatorMessage","status":true,"httpstatus":200,
        // "data":{"notify_for_gat":"","isExist":true,"exMsg":"","two_isOpenClick":["93","95","97","99"],
        //"other_isOpenClick":["91","93","98","99","95","97"], "normal_passengers": [p1,p2,p3...],
        //"dj_passengers":[]},"messages":[],"validateMessages":{}}
        let ret = await fetch(`https://${API.url}/otn/confirmPassenger/getPassengerDTOs`, {
            "credentials": "include",
            "headers": API.apiHeader(),
            "referrer": `https://${API.url}/otn/confirmPassenger/initDc`,
            "body": `_json_att=&REPEAT_SUBMIT_TOKEN=${repeatSubmitToken}`,
            "method": "POST",
            "mode": "cors"
        }).then(value => {
            if (value.ok) {
                return value.json();
            } else {
                console.log("get passenger failed: " + value.error());
                console.error("get passenger failed");
                return {"status": false, "messages": "call api failed"}
            }
        });

        if (ret["status"] === true) {
            return ret["data"]["normal_passengers"];
        } else {
            console.error("get normal passengers list failed: " + JSON.stringify(ret["messages"]));
            return [];
        }
    },
    /**
     * 前面排队人数
     * @param trainDate 2021-01-11 transfer to (Tue Sep 29 2020 00:00:00 GMT+0800 (中国标准时间))
     * @param trainNo 56000K115200  班次id
     * @param trainCode K1152 班次
     * @param seatType 1
     * @param fromStationNo HZH
     * @param toStationNo CXW
     * @param leftTicket bP2rrfeOWXeRkF%2Fh%2FjQr2ouIfDueVsIbjwrIXdDXDnpdKVziqYwp20JyFQ0%3D
     * @param purposeCodes 00
     * @param trainLocation H6
     * @param repeatSubmitToken e5c94ff235354551d16ecee352f924ad
     * @returns {Promise<{}>}
     * {"status": true, "data": {leftTicketInfo}} 或者 {"status": false, "data": [messages]}
     *
     * api成功：
     * {"validateMessagesShowId":"_validatorMessage","status":true,"httpstatus":200,
     * "data":{"count":"7", //排队人数
     * "ticket":"493,0",   //硬座：“有座票数，无座票数”; 卧铺： “剩余票数”
     * "op_2":"false","countT":"0","op_1":"true"},"messages":[],"validateMessages":{}}
     * api失败：
     * {"validateMessagesShowId":"_validatorMessage","status":false,"httpstatus":200,"messages":["系统繁忙，请稍后重试！"],"validateMessages":{}}
     */
    getQueueCount: async (repeatSubmitToken, trainDate, trainNo, trainCode, seatType, fromStationNo,
                          toStationNo, leftTicket, purposeCodes, trainLocation) => {
        let body = `train_date=${encodeURIComponent(new Date(trainDate).toString())}&train_no=${trainNo}&stationTrainCode=${trainCode}&seatType=${seatType}` +
            `&fromStationTelecode=${fromStationNo}&toStationTelecode=${toStationNo}&leftTicket=${leftTicket}` +
            `&purpose_codes=${purposeCodes}&train_location=${trainLocation}&_json_att=&REPEAT_SUBMIT_TOKEN=${repeatSubmitToken}`

        console.log("[getQueueCount] body: ", body)

        return fetch(`https://${API.url}/otn/confirmPassenger/getQueueCount`, {
            "credentials": "include",
            "headers": API.apiHeader(),
            "referrer": `https://${API.url}/otn/confirmPassenger/initDc`,
            "body": body,
            "method": "POST",
            "mode": "cors"
        }).then(value => {
            if (value.ok) {
                if (value.redirected) {
                    throw new Error("api failed");
                } else {
                    return value.json();
                }
            } else {
                console.log("get queue count for this train failed")
                throw new Error("call api failed")
            }
        }).then(ret => {
            if (ret["status"] === true) {
                return {"status": true, "data": ret["data"]};
            } else {
                throw new Error("failed to getQueueCount");
            }
        });
    },

    /**
     *
     * @param repeatSubmitToken e5c94ff235354551d16ecee352f924ad
     * @param passengerTicketStr 1,0,1,xx,1,5124***********213,182****7119,N,4b794e3fad154744f8c12d92aa....af721c63b
     * @param oldPassengerStr  xx,1,5124***********213,3_
     * @param tourFlag dc
     * @param whatsSelect 1
     * @returns {Promise<boolean>} true 表示成功
     * {"validateMessagesShowId":"_validatorMessage","status":true,"httpstatus":200,
     * "data":{"canChooseBeds":"N","canChooseSeats":"N","choose_Seats":"MOP9Q","isCanChooseMid":"N",
     * "ifShowPassCodeTime":"1","submitStatus":true,"smokeStr":""},"messages":[],"validateMessages":{}}
     */
    checkOrderInfo: async (repeatSubmitToken, passengerTicketStr, oldPassengerStr,
                           tourFlag = "dc", whatsSelect = "1") => {
        let body = `cancel_flag=2&bed_level_order_num=000000000000000000000000000000&passengerTicketStr=${encodeURIComponent(passengerTicketStr)}` +
            `&oldPassengerStr=${encodeURIComponent(oldPassengerStr)}&tour_flag=${tourFlag}&randCode=&whatsSelect=${whatsSelect}&sessionId=&sig=&scene=nc_login` +
            `&_json_att=&REPEAT_SUBMIT_TOKEN=${repeatSubmitToken}`

        console.log("[checkOrderInfo], body: %s", body);

        let ret = await fetch(`https://${API.url}/otn/confirmPassenger/checkOrderInfo`, {
            "credentials": "include",
            "headers": API.apiHeader(),
            "referrer": `https://${API.url}/otn/confirmPassenger/initDc`,
            "body": body,
            "method": "POST",
            "mode": "cors"
        }).then(value => {
            if (value.ok) {
                return value.json();
            } else {
                throw new Error("[checkOrderInfo] failed");
            }
        });

        if (ret["status"] === true) {
            if (ret["data"]["submitStatus"] === false) {
                throw new Error(JSON.stringify(ret["data"]["errMsg"]));
            }
        } else {
            throw new Error(JSON.stringify(ret["messages"]));
        }
    },

    /**
     * 确认订单
     * @param passengerTicketStr 1,0,1,xx,1,5124***********213,182****7119,N,4b794e3fad154744f8c12d92aa....af721c63b
     * @param oldPassengerStr xx,1,5124***********213,3_
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
    confirmSingleForQueue: async (repeatSubmitToken, passengerTicketStr, oldPassengerStr, keyCheckIsChange, leftTicketStr,
                                  trainLocation, purposeCodes = "00", seatDetailType = "", isJy = "N",
                                  encryptedData = "", whatsSelect = "1", roomType = "00") => {
        /*
        {
           'passengerTicketStr': '1,0,1,xxx,1,5119***********921,134****0779,N,ac1b75b87900b....069be9bbcc58',
           'oldPassengerStr': 'xxx,1,5119***********921,1_',
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
        console.log("confirmOrder body: ", body);

        //{"validateMessagesShowId":"_validatorMessage","status":true,"httpstatus":200,
        // "data":{"submitStatus":true},"messages":[],"validateMessages":{}}
        return await fetch(`https://${API.url}/otn/confirmPassenger/confirmSingleForQueue`, {
            "credentials": "include",
            "headers": API.apiHeader(),
            "referrer": `https://${API.url}/otn/confirmPassenger/initDc`,
            "body": body,
            "method": "POST",
            "mode": "cors"
        }).then(value => {
            if (value.ok) {
                return value.json();
            } else {
                console.log("confirmOrder for passenger %s failed: ", passengerTicketStr, value.error());
                throw new Error("确认订单API失败")
            }
        }).then(ret => {
            if (ret["status"] !== true || ret["data"]["submitStatus"] !== true) {
                throw new Error("确认订单失败")
            }
            console.log("[confirmSingleForQueue] submit order done");
        });
    },

    /**
     * 查询下单是否成功
     * @param repeatSubmitToken
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
    queryOrderWaitTime: async (repeatSubmitToken, tourFlag = "dc") => {
        let paramsUrl = `random=${new Date().getTime()}&tourFlag=${tourFlag}&_json_att=&REPEAT_SUBMIT_TOKEN=${repeatSubmitToken}`
        return await fetch(`https://${API.url}/otn/confirmPassenger/queryOrderWaitTime?${paramsUrl}`, {
            "credentials": "include",
            "headers": API.apiHeader(),
            "referrer": `https://${API.url}/otn/confirmPassenger/initDc`,
            "referrerPolicy": "no-referrer-when-downgrade",
            "body": null,
            "method": "GET",
            "mode": "cors"
        }).then(value => {
            if (value.ok) {
                return value.json();
            } else {
                console.log("queryOrderWaitTime failed: ", value.error());
                throw new Error("查询订单API失败")
            }
        }).then(ret => {
            console.log("[queryOrderWaitTime] %s", JSON.stringify(ret));
            if (ret["status"] === true && !isEmpty(ret["data"]["orderId"])) {
                return ret["data"]["orderId"];
            } else {
                throw new Error("下单失败");
            }
        });
    },

    /**
     *
     * @param orderSequenceNo E660544459
     * @param repeatSubmitToken 30d832ac9dba13a9e37f0de37d501be9
     * @returns {Promise<Response>}
     */
    resultOrderForDcQueue: async (orderSequenceNo, repeatSubmitToken) => {
        return await fetch(`https://${API.url}/otn/confirmPassenger/resultOrderForDcQueue`, {
            "credentials": "include",
            "headers": API.apiHeader(),
            "referrer": `https://${API.url}/otn/confirmPassenger/initDc`,
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
    },

    goToPayPage: async () => {
        return await fetch(`https://${API.url}/otn//payOrder/init?random=1609490923629`, {
            "credentials": "include",
            "headers": API.apiHeader(),
            "referrer": `https://${API.url}/otn/confirmPassenger/initDc`,
            "referrerPolicy": "no-referrer-when-downgrade",
            "body": "_json_att=&REPEAT_SUBMIT_TOKEN=30d832ac9dba13a9e37f0de37d501be9",
            "method": "POST",
            "mode": "cors"
        });
    }
}