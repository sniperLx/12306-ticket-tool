//谁 买 什么时间  哪一班车 哪种位置

function getSeatTypeCode(seatType) {
    let yz = "硬座";
    let rz = "软座";
    let yw = "硬卧";
    let rw = "软卧";
    let seatTypeMap = {'yz': 1, 'rz': 2, 'yw': 3, 'rw': 4};

    switch (seatType) {
        case yz:
            return seatTypeMap['yz'];
        case rz:
            return seatTypeMap['rz'];
        case yw:
            return seatTypeMap['yw'];
        case rw:
            return seatTypeMap['rw'];
        default:
            alert("error seatType: " + seatType);
            console.error("error seat type: " + seatType);
            return;
    }
}

const ADULT = 1
const STUDENT = 3

let taskRelatedInfoCache = {
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

$(document).ready(() => {
    if ($('#keepalive-task').is(':checked')) {
        //console.log("开始心跳保活");
        keepActive().then(v => console.log("开始心跳保活"));
    }

    $("#submit-task").on('click', async () => {
        //姓名/车次/出发日期/起点站/终点站/座位类型/是否成人/开始抢票时间
        let taskInfo = $("#ticket-task-info").val();
        console.log(taskInfo);
        let paramsArr = taskInfo.split("/");
        if (paramsArr.length !== 8) {
            alert("输入参数格式不对，请检查");
            return;
        }

        let taskParams = {
            "passenger": paramsArr[0], //乘客姓名
            "trainCode": paramsArr[1], //车次
            "trainDate": paramsArr[2], //出发日期,
            "fromStationName": paramsArr[3],  //起点站名
            "toStationName": paramsArr[4],    //终点站名
            "seatType": getSeatTypeCode(paramsArr[5]),  //座位类型
            "ticketType": paramsArr[6] === "Y" ? ADULT : STUDENT, //票类型，成人票或者学生票
            "startOrderTime": paramsArr[7], //开始下单抢票时间
            "fromStationNo": "",
            "toStationNo": "",
            "isOk": false
        };

        taskParams["fromStationNo"] = getStationNo(taskParams["fromStationName"]);
        taskParams["toStationNo"] = getStationNo(taskParams["toStationName"]);

        taskRelatedInfoCache["task"] = taskParams;
        taskRelatedInfoCache["task"]["isOk"] = true;

        await submitTask();

        console.log("submit task success: ", JSON.stringify(taskParams));
    });
})

let submitTask = async (retryCnt = 1, retryInterval = 3) => {
    if (retryCnt <= 0) {
        return;
    }
    //查询余票接口，只在下单前一分钟调一次获取车次相关的参数，后续不再调用，避免影响下单效率
    await initTrainInfo();

    await initDcTicketInfoForPassenger();

    await initPassengerStrInfo();

    if ($("#query-ticket-cnt-task").is(':checked')) {
        let ok = queryOrBuyTicket(false).then(() => console.log("[submitTask], query ticket task submitted"));
        if (ok) {
            return;
        }
    }

    if ($("#query-ticket-and-buy-task").is(':checked')) {
        let ok = queryOrBuyTicket(true).then(() => console.log("[submitTask], buy ticket task submitted"));
        if (ok) {
            return;
        }
    }

    setTimeout(submitTask, retryInterval * 1000, retryCnt - 1, retryInterval);
}

/**
 *
 * @param buy 是否下单
 * @param retryCnt 重试次数
 * @param retryInterval 重试时间间隔 s
 * @returns {Promise<boolean>}
 */
let queryOrBuyTicket = async (buy = false, retryCnt = 3, retryInterval = 3) => {
    if (retryCnt <= 0) {
        //需要下单还执行到这里, 说明下单失败, 返回false; 否则只是单纯查余票, 返回true
        return !buy;
    }

    if (!isInfoReadyInCache("ticketOrderInfo", "passengerInfo", "task")) {
        console.log("[queryTicket] params not ready in cache");
        return false;
    }

    let isOk = await checkOrderInfo(taskRelatedInfoCache["ticketOrderInfo"]["repeatSubmitToken"],
        taskRelatedInfoCache["passengerInfo"]["passengerTicketStr"],
        taskRelatedInfoCache["passengerInfo"]["oldPassengerStr"]);
    if (!isOk) {
        console.log("[queryTicket], checkOrderInfo failed");
        return false;
    }

    let ret = await getQueueCount(taskRelatedInfoCache["ticketOrderInfo"]["repeatSubmitToken"],
        taskRelatedInfoCache["task"]["trainDate"], taskRelatedInfoCache["trainInfo"]["trainNo"],
        taskRelatedInfoCache["task"]["trainCode"], taskRelatedInfoCache["task"]["seatType"],
        taskRelatedInfoCache["task"]["fromStationNo"], taskRelatedInfoCache["task"]["toStationNo"],
        taskRelatedInfoCache["ticketOrderInfo"]["leftTicketStr"], taskRelatedInfoCache["ticketOrderInfo"]["purposeCodes"],
        taskRelatedInfoCache["ticketOrderInfo"]["trainLocation"])

    if (ret["status"] === true) {
        console.log("[queryTicket], getQueueCount: ", ret["data"]);
        let queueCnt = parseInt(ret["data"]["count"], 10);
        let ticketCnt = parseInt(ret["data"]["ticket"].split(",")[0], 10);
        if (buy && queueCnt <= ticketCnt) {
            let ok = await buyTicket();
            if (ok) {
                return true;
            }
        }
    } else {
        console.log("[queryTicket], getQueueCount failed: ", ret["data"]);
    }

    setTimeout(queryOrBuyTicket, retryInterval * 1000, buy, retryCnt - 1, retryInterval);
}

/**
 * 提交订单, 提交失败会默认重试3次，提交成功则反复查询后台下单结果
 * @param retryCnt 默认重试3此
 * @param retryInterval 默认隔3s重试一次
 * @returns {Promise<boolean>}
 */
let buyTicket = async (retryCnt = 3, retryInterval = 3) => {
    if (retryCnt <= 0) {
        alert(`抱歉! 下单尝试3次失败, 请重新提交`);
        return false;
    }
    console.log("submit order: trying #%s", retryCnt);
    if (!isInfoReadyInCache("ticketOrderInfo", "passengerInfo")) {
        console.log("[buyTicket] params are not ready")
        return false;
    }

    //单程票下单
    let isOk = await confirmSingleForQueue(taskRelatedInfoCache["ticketOrderInfo"]["repeatSubmitToken"],
        taskRelatedInfoCache["passengerInfo"]["passengerTicketStr"], taskRelatedInfoCache["passengerInfo"]["oldPassengerStr"],
        taskRelatedInfoCache["ticketOrderInfo"]["keyCheckIsChange"], taskRelatedInfoCache["ticketOrderInfo"]["leftTicketStr"],
        taskRelatedInfoCache["ticketOrderInfo"]["trainLocation"], taskRelatedInfoCache["ticketOrderInfo"]["purposeCodes"]);
    if (!isOk) {
        console.log("[buyTicket], confirmSingleForQueue. 抱歉! 下单失败, 将要重试")
        await new Promise(() => setTimeout(buyTicket, retryInterval * 1000, retryCnt - 1, retryInterval));
        return false;
    }

    //查询是否购买成功
    let orderId = await queryOrderWaitTime(taskRelatedInfoCache["ticketOrderInfo"]["repeatSubmitToken"]);
    if (!isEmpty(orderId)) {
        console.log(`[buyTicket], queryOrderWaitTime. 恭喜! 购买成功，请到12306官网支付订单： ${orderId}`)
        alert(`恭喜! 购买成功，请到12306官网支付订单： ${orderId}`);
        return true;
    } else {
        console.log("[buyTicket], queryOrderWaitTime. 购买失败, 请重新下单")
        alert("购买失败，请重新下单");
    }
}


let keepActive = async () => {
    let ok = await queryMyOrderNotCompleted();
    if (ok) {
        setTimeout(keepActive, 20 * 1000);
    } else {
        console.log("[keepActive], queryMyOrderNotCompleted. 检测到已经退出了12306, 请重新登陆后继续");
        alert("检测到已经退出了12306, 请重新登陆后继续!");
    }
}

function isInfoReadyInCache(...arguments) {
    for (let arg of arguments) {
        if (!taskRelatedInfoCache[arg]["isOk"]) {
            console.log(`[isInfoReadyInCache], ${arg} is not ok.`);
            return false;
        }
    }

    return true;
}

/**
 *  seatType 座位类型：硬座1,软座2,硬卧3,软卧4
 *  ticketType 成人票1,儿童票2,学生票3,残军票4
 * @returns {Promise<void>}
 * {passengerTicketStr: string, oldPassengerStr: string}
 */
async function initPassengerStrInfo() {
    if (taskRelatedInfoCache["passengerInfo"]["isOk"]) {
        console.log("[initPassengerStrInfo] passengerInfo is already ready, don't query again")
        return;
    }

    if (!isInfoReadyInCache("ticketOrderInfo", "task")) {
        console.log("[initPassengerStrInfo] params are not ready")
        return;
    }
    let repeatSubmitToken = taskRelatedInfoCache["ticketOrderInfo"]["repeatSubmitToken"];
    let passengerName = taskRelatedInfoCache["task"]["passenger"];

    let seatType = taskRelatedInfoCache["task"]["seatType"];
    seatType = isEmpty(seatType) ? "1" : seatType; //默认硬座

    let ticketType = taskRelatedInfoCache["task"]["ticketType"];
    ticketType = isEmpty(ticketType) ? ADULT : ticketType; //默认成人票

    let allNormalPassengersInfoArr = await getPassengersInfo(repeatSubmitToken);
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

    taskRelatedInfoCache["passengerInfo"]["passengerTicketStr"] = passengerTicketStr;
    taskRelatedInfoCache["passengerInfo"]["oldPassengerStr"] = oldPassengerStr;
    taskRelatedInfoCache["passengerInfo"]["isOk"] = true;
}

/**
 * @returns {void}
 * trainTicketsInfoMap: {"D656":{"secretStr": "xxx", "trainNo": "5e0000D65660"},
 * "G1337":{"secretStr": "xxx", "trainNo": "5l000G133741"}, "fromStationNo": "HGH", "toStationNo": YYY}
 */
let initTrainInfo = async () => {
    if (!isInfoReadyInCache("task")) {
        console.log("[initTrainInfo] params are not ready")
        return;
    }
    let trainTicketsRetMap = await queryLeftTicket(taskRelatedInfoCache["task"]["trainDate"],
        taskRelatedInfoCache["task"]["fromStationNo"], taskRelatedInfoCache["task"]["toStationNo"]);

    if (isEmpty(trainTicketsRetMap)) {
        console.log("[initTrainInfo] queryLeftTicket. 连续多次查询余票失败, 请到官网确认");
        alert("连续多次查询余票失败, 请到12306官网确认");
        return;
    }

    console.log("[initTrainInfo] queryLeftTicket: ", trainTicketsRetMap)

    let resultArr = trainTicketsRetMap["result"];

    for (let i = 0; i < resultArr.length; i++) {
        //"secretStr-xxkey|预订|5e0000D65660|D656|NGH|CUW|HGH|CUW|08:25|20:32|12:07|Y|zIb8mX2PNvZv65v1crFsdHTJD77ySZn%2FQdOVw%2FW3DSOppnWx
        // |20200929|3|H2|04|23|1|0|||||||无||||14|有|||O0M0W0|OMO|0|0||O055900014M089500021O055903000||||||1|0"
        let oneTrainInfoArr = resultArr[i].split("|");
        let secretStr = oneTrainInfoArr[0]; //每次查询车票，同一班车的这个值都会变化，停运车次该字段为空
        let trainStatus = oneTrainInfoArr[1]; //预定，列车停运
        let trainNo = oneTrainInfoArr[2]; // 5e0000D65660
        let trainCode = oneTrainInfoArr[3]; // D656

        if (trainCode === taskRelatedInfoCache["task"]["trainCode"]) {
            if (isEmpty(secretStr)) {
                console.log("[initTrainInfo] %s, empty secretStr", `${trainCode} 状态异常： ${trainStatus}`);
                alert(`${trainCode} 状态异常： ${trainStatus}, 请选择其他车次`);
                return;
            }
            taskRelatedInfoCache["trainInfo"]["secretStr"] = secretStr;
            taskRelatedInfoCache["trainInfo"]["trainNo"] = trainNo;
            taskRelatedInfoCache["trainInfo"]["isOk"] = true;
            return;
        }
    }

    console.log("[initTrainInfo] 未找到班次： %s, 请登陆12306确认", taskRelatedInfoCache["task"]["trainCode"]);
    alert(`未找到班次： ${taskRelatedInfoCache["task"]["trainCode"]}, 请登陆12306确认`)
}

function isEmpty(obj) {
    switch (typeof obj) {
        case "number":
        case "boolean":
        case "symbol":
        case "bigint":
        case "function":
            return false;
        default:
            //string, undefined, null, object
            return obj === 'undefined' || obj === null || obj === "" || Object.keys(obj).length === 0;
    }
}
