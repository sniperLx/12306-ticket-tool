class Task {
    constructor(taskParams) {
        this.taskRelatedInfoCache = {
            "task": {
                "isOk": false,
                "passenger": "", //乘客姓名
                "trainCode": "", //车次
                "trainDate": "", //出发日期,
                "fromStationName": "",  //起点站名
                "toStationName": "",   //终点站名
                "seatType": "", //座位类型
                "ticketType": "", //票类型，成人票或者学生票
                "startOrderTime": "", //开始下单抢票时间
                "fromStationNo": "",
                "toStationNo": ""
            },
            "trainInfo": { //initTrainInfo
                "isOk": false,
                "secretStr": "",
                "trainNo": ""
            },
            "ticketOrderInfo": { //initDcTicketInfoForPassenger
                "isOk": false,
                "keyCheckIsChange": "",
                "leftTicketStr": "",
                "trainLocation": "",
                "purposeCodes": "",
                "repeatSubmitToken": ""
            },
            "passengerInfo": { //initPassengerStrInfo
                "isOk": false,
                "passengerTicketStr": "",
                "oldPassengerStr": ""
            }
        };

        this.taskRelatedInfoCache["task"] = taskParams;
        this.taskRelatedInfoCache["task"]["isOk"] = true;
    }

    isInfoReadyInCache(...args) {
        for (let arg of args) {
            if (!this.taskRelatedInfoCache[arg]["isOk"]) {
                console.log(`[isInfoReadyInCache], ${arg} is not ok.`);
                return false;
            }
        }
        return true;
    }

    submitTask(retryCnt = 1, retryInterval = 3) {
        //查询余票接口，只在下单前一分钟调一次获取车次相关的参数，后续不再调用，避免影响下单效率
        if ($("#query-ticket-cnt-task").is(':checked')) {
            this.queryTicket().then((ret) => {
                console.log("[submitTask] 本班次余票信息： " + JSON.stringify(ret));
                alert("本班次余票信息： " + ret)
            });
        } else if ($("#query-ticket-and-buy-task").is(':checked')) {
            this.queryTicket()
                .then(() => this.initDcTicketInfoForPassenger())
                .then(() => this.initPassengerStrInfo())
                .then(() => this.queryTicketAndQueueLen())
                .then(() => this.buyTicket(3, retryInterval))
                .then(orderId => alert(`恭喜! 购买成功，请到12306官网支付订单： ${orderId}`))
                .catch(err => {
                    console.log("[submitTask] ", err.stack);
                    alert(err.message)
                });
        } else {
            console.log("请选择查询余票或者下单抢票");
            alert("请选择一个选项： 查询余票； 下单抢票");
        }
    }

    /**
     * @returns {Promise<>}
     */
    queryTicketAndQueueLen() {
        return new Promise((resolve, reject) => {
            if (!this.isInfoReadyInCache("ticketOrderInfo", "passengerInfo", "task")) {
                reject(new Error("[queryTicketAndQueueLen] params not ready in cache"));
                return;
            }
            resolve();
        }).then(() => API.checkOrderInfo(this.taskRelatedInfoCache["ticketOrderInfo"]["repeatSubmitToken"],
            this.taskRelatedInfoCache["passengerInfo"]["passengerTicketStr"],
            this.taskRelatedInfoCache["passengerInfo"]["oldPassengerStr"])
        ).then(() => {
            return API.getQueueCount(this.taskRelatedInfoCache["ticketOrderInfo"]["repeatSubmitToken"],
                this.taskRelatedInfoCache["task"]["trainDate"], this.taskRelatedInfoCache["trainInfo"]["trainNo"],
                this.taskRelatedInfoCache["task"]["trainCode"], this.taskRelatedInfoCache["task"]["seatType"],
                this.taskRelatedInfoCache["task"]["fromStationNo"], this.taskRelatedInfoCache["task"]["toStationNo"],
                this.taskRelatedInfoCache["ticketOrderInfo"]["leftTicketStr"], this.taskRelatedInfoCache["ticketOrderInfo"]["purposeCodes"],
                this.taskRelatedInfoCache["ticketOrderInfo"]["trainLocation"])
        }).then(ret => {
            if (ret["status"] === true) {
                console.log("[queryTicketAndQueueLen], getQueueCount: ", ret["data"]);
                let queueCnt = parseInt(ret["data"]["count"], 10);
                let ticketCnt = parseInt(ret["data"]["ticket"].split(",")[0], 10);
                if (queueCnt > ticketCnt) {
                    throw new Error("余票小于排队人数");
                }
            } else {
                throw new Error("查询排队人数失败");
            }
        })
    }


    /**
     * 提交订单, 提交失败会默认重试3次，提交成功则反复查询后台下单结果
     * @param retryCnt 默认重试3此
     * @param retryInterval 默认隔3s重试一次
     * @returns {Promise<>}
     */
    buyTicket(retryCnt = 5, retryInterval = 3) {
        return new Promise((resolve, reject) => {
            if (!this.isInfoReadyInCache("ticketOrderInfo", "passengerInfo")) {
                console.log("[buyTicket] params are not ready")
                reject(new Error("乘客信息或者订单信息准备失败"))
            }
            resolve();
        }).then(() => {
            return API.confirmSingleForQueue(this.taskRelatedInfoCache["ticketOrderInfo"]["repeatSubmitToken"],
                this.taskRelatedInfoCache["passengerInfo"]["passengerTicketStr"], this.taskRelatedInfoCache["passengerInfo"]["oldPassengerStr"],
                this.taskRelatedInfoCache["ticketOrderInfo"]["keyCheckIsChange"], this.taskRelatedInfoCache["ticketOrderInfo"]["leftTicketStr"],
                this.taskRelatedInfoCache["ticketOrderInfo"]["trainLocation"], this.taskRelatedInfoCache["ticketOrderInfo"]["purposeCodes"]);
        }).then(() => {
            return API.retry(API.queryOrderWaitTime, retryCnt, retryInterval, this.taskRelatedInfoCache["ticketOrderInfo"]["repeatSubmitToken"])
        }).then((orderId) => {
            if (!isEmpty(orderId)) {
                console.log(`[buyTicket], queryOrderWaitTime. 恭喜! 购买成功，请到12306官网支付订单： ${orderId}`)
                return orderId;
            } else {
                console.log("[buyTicket], queryOrderWaitTime. 购买失败, 请重新下单")
                throw new Error("下单失败");
            }
        });
    }

    /**
     *  seatType 座位类型：硬座1,软座2,硬卧3,软卧4
     *  ticketType 成人票1,儿童票2,学生票3,残军票4
     * @returns {Promise<void>}
     * {passengerTicketStr: string, oldPassengerStr: string}
     */
    async initPassengerStrInfo() {
        if (this.taskRelatedInfoCache["passengerInfo"]["isOk"]) {
            console.log("[initPassengerStrInfo] passengerInfo is already ready, don't query again")
            return;
        }

        if (!this.isInfoReadyInCache("ticketOrderInfo", "task")) {
            console.log("[initPassengerStrInfo] params are not ready")
            return;
        }
        let repeatSubmitToken = this.taskRelatedInfoCache["ticketOrderInfo"]["repeatSubmitToken"];
        let passengerName = this.taskRelatedInfoCache["task"]["passenger"];

        let seatType = this.taskRelatedInfoCache["task"]["seatType"];
        seatType = isEmpty(seatType) ? "1" : seatType; //默认硬座

        let ticketType = this.taskRelatedInfoCache["task"]["ticketType"];
        ticketType = isEmpty(ticketType) ? ADULT : ticketType; //默认成人票

        let allNormalPassengersInfoArr = await API.getPassengersInfo(repeatSubmitToken);
        let passengerInfo;
        for (let i = 0; i < allNormalPassengersInfoArr.length; i++) {
            passengerInfo = allNormalPassengersInfoArr[i];
            if (passengerInfo["passenger_name"] === passengerName) {
                break;
            }
        }
        let passengerIdNo = passengerInfo["passenger_id_no"];
        let mobileNo = passengerInfo["mobile_no"] == null ? "" : passengerInfo["mobile_no"];
        let allEncStr = passengerInfo["allEncStr"];
        //passengerTicketStr: 3,0,1,xx,1,5119***********911,124****0689,N,ac1b75b....a55590b265d68239be9bbcc58
        //oldPassengerStr: xx,1,5119***********911,1_
        let passengerTicketStr = `${seatType},0,${ticketType},${passengerName},1,${passengerIdNo},${mobileNo},N,${allEncStr}`;
        let oldPassengerStr = `${passengerName},1,${passengerIdNo},1_`;

        this.taskRelatedInfoCache["passengerInfo"]["passengerTicketStr"] = passengerTicketStr;
        this.taskRelatedInfoCache["passengerInfo"]["oldPassengerStr"] = oldPassengerStr;
        this.taskRelatedInfoCache["passengerInfo"]["isOk"] = true;
    }

    /**
     * @returns {void}
     * trainTicketsInfoMap: {"D656":{"secretStr": "xxx", "trainNo": "5e0000D65660"},
     * "G1337":{"secretStr": "xxx", "trainNo": "5l000G133741"}, "fromStationNo": "HGH", "toStationNo": YYY}
     */
    async queryTicket() {
        if (!this.isInfoReadyInCache("task")) {
            console.log("[queryTicket] params are not ready")
            throw new Error("任务未被初始化");
        }

        let trainTicketsRetMap = await API.retry(API.queryLeftTicket, 3, 1000,
            this.taskRelatedInfoCache["task"]["trainDate"],
            this.taskRelatedInfoCache["task"]["fromStationNo"],
            this.taskRelatedInfoCache["task"]["toStationNo"]);

        if (isEmpty(trainTicketsRetMap)) {
            console.log("[queryTicket] queryLeftTicket failed, plz confirm it at 12306");
            throw new Error("连续多次查询余票失败, 请到12306官网确认");
        }

        let resultArr = trainTicketsRetMap["result"];

        for (let i = 0; i < resultArr.length; i++) {
            //"secretStr-xxkey|预订|5e0000D65660|D656|NGH|CUW|HGH|CUW|08:25|20:32|12:07|Y|zIb8mX2PNvZv65v1crFsdHTJD77ySZn%2FQdOVw%2FW3DSOppnWx
            // |20200929|3|H2|04|23|1|0|||||||无||||14|有|||O0M0W0|OMO|0|0||O055900014M089500021O055903000||||||1|0"
            let oneTrainInfoArr = resultArr[i].split("|");
            let secretStr = oneTrainInfoArr[0]; //每次查询车票，同一班车的这个值都会变化，停运车次该字段为空
            let trainStatus = oneTrainInfoArr[1]; //预定，列车停运
            let trainNo = oneTrainInfoArr[2]; // 5e0000D65660
            let trainCode = oneTrainInfoArr[3]; // D656

            if (trainCode === this.taskRelatedInfoCache["task"]["trainCode"]) {
                if (isEmpty(secretStr)) {
                    console.log("[queryTicket] %s, empty secretStr", `${trainCode} 状态异常： ${trainStatus}`);
                    throw new Error(`${trainCode} 状态异常： ${trainStatus}, 请选择其他车次`);
                }

                let hasTicketLeft = false;
                for (let j = 20; j < 34; j++) {
                    let val = oneTrainInfoArr[j];
                    if (val !== "" && val !== "无") {
                        hasTicketLeft = true;
                        oneTrainInfoArr[0] = "xxx";
                        oneTrainInfoArr[12] = "xxx";
                        console.log("[queryTicket] 返回值： " + JSON.stringify(oneTrainInfoArr));
                        break;
                    }
                }

                let leftTicket = getTicketCount(oneTrainInfoArr);

                this.taskRelatedInfoCache["trainInfo"]["secretStr"] = secretStr;
                this.taskRelatedInfoCache["trainInfo"]["trainNo"] = trainNo;
                this.taskRelatedInfoCache["trainInfo"]["isOk"] = true;
                return hasTicketLeft ? leftTicket : new Error("这班车没票了");
            }
        }

        console.log("[queryTicket] cannot find train： %s, plz confirm it", this.taskRelatedInfoCache["task"]["trainCode"]);
        throw new Error(`未找到班次： ${this.taskRelatedInfoCache["task"]["trainCode"]}, 请登陆12306确认`)
    }

    setUrl() {
        let size = cdnIps.length;
        let index = Math.floor(Math.random() * size);
        API.url = cdnIps[index];
    }

    /**
     * 查询单程票信息
     * @returns {Promise<void>}
     */
    async initDcTicketInfoForPassenger() {
        if (this.taskRelatedInfoCache["ticketOrderInfo"]["isOk"]) {
            console.log("[initDcTicketInfoForPassenger] ticketOrderInfo are already ready, don't query again")
            return;
        }

        if (!this.isInfoReadyInCache("trainInfo", "task")) {
            console.log("[initDcTicketInfoForPassenger] params are not ready")
            return;
        }

        await API.submitOrderRequest(this.taskRelatedInfoCache["trainInfo"]["secretStr"], this.taskRelatedInfoCache["task"]["trainDate"],
            this.taskRelatedInfoCache["task"]["trainDate"], this.taskRelatedInfoCache["task"]["fromStationName"],
            this.taskRelatedInfoCache["task"]["toStationName"]).then(() => API.initDc()
            .then(resp => {
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
                console.log("[initDcTicketInfoForPassenger], token=" + token);

                startPos = resp.indexOf("ticketInfoForPassengerForm");
                if (startPos === -1) {
                    console.log("[initDcTicketInfoForPassenger], initDc返回内容错误, cannot find ticketInfoForPassengerForm in response");
                    throw new Error("initDc返回内容错误");
                }
                endPos = startPos;
                for (let i = startPos; i < startPos + 10000; i++) {
                    if (resp[i] === ";") {
                        endPos = i;
                        break;
                    }
                }
                let ticketInfoForPassengerFormLine = resp.substring(startPos, endPos);
                //格式参考passengerInfo_js.js中内容
                let ticketInfoForPassengerFormMap = JSON.parse(
                    ticketInfoForPassengerFormLine.split("=")[1].replace(/'/g, "\""));

                this.taskRelatedInfoCache["ticketOrderInfo"]["keyCheckIsChange"] = ticketInfoForPassengerFormMap["key_check_isChange"];
                this.taskRelatedInfoCache["ticketOrderInfo"]["leftTicketStr"] = ticketInfoForPassengerFormMap["leftTicketStr"];
                this.taskRelatedInfoCache["ticketOrderInfo"]["trainLocation"] = ticketInfoForPassengerFormMap["train_location"];
                this.taskRelatedInfoCache["ticketOrderInfo"]["purposeCodes"] = ticketInfoForPassengerFormMap["queryLeftTicketRequestDTO"]["purpose_codes"];
                this.taskRelatedInfoCache["ticketOrderInfo"]["repeatSubmitToken"] = token;
                this.taskRelatedInfoCache["ticketOrderInfo"]["isOk"] = true;

                console.log("[initDcTicketInfoForPassenger],  taskRelatedInfoCache: ", JSON.stringify(this.taskRelatedInfoCache))
            }))
    }
}