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

$(document).ready(() => {
    $('#keepalive-task').click(async () => {
        console.log("开始心跳保活");
        await keepActive();
    });

    $("#submit-task").on('click', async () => {
        //姓名/车次/出发日期/起点站/终点站/座位类型/是否成人/开始抢票时间
        let taskInfo = $("#ticket-task-info").val();
        console.log(taskInfo);
        let paramsArr = taskInfo.split("/");
        if (paramsArr.length !== 8) {
            alert("输入参数格式不对，请检查");
            return;
        }
        let passenger = paramsArr[0]; //乘客姓名
        let trainCode = paramsArr[1]; //车次
        let trainDate = paramsArr[2]; //出发日期
        let fromStationName = paramsArr[3];  //起点站名
        let toStationName = paramsArr[4];   //终点站名
        let seatType = getSeatTypeCode(paramsArr[5]); //座位类型
        let ticketType = paramsArr[6] === "Y" ? 1 : 3; //票类型，成人票或者学生票
        let startOrderTime = paramsArr[7]; //开始下单抢票时间

        await submitTask(passenger, trainCode, trainDate, fromStationName, toStationName, seatType, ticketType, startOrderTime);

        console.info("submit task success");
    });
})



let ticketInfoForPassengerMap;
let submitTask = async (passenger, trainCode, trainDate, fromStationName, toStationName,
                        seatType, ticketType, startOrderTime) => {
    //查询余票接口，只在下单前一分钟调一次获取车次相关的参数，后续不再调用，避免影响下单效率
    let trainTicketsInfoMap = await parseAndInitTrainInfo(trainDate, fromStationName, toStationName);
    if (isEmpty(trainTicketsInfoMap)) {
        console.log("查询班次信息失败");
        return;
    }
    let secretStr = trainTicketsInfoMap[trainCode]["secretStr"];
    let trainNo = trainTicketsInfoMap[trainCode]["trainNo"];
    let fromStationNo = trainTicketsInfoMap["fromStationNo"]
    let toStationNo = trainTicketsInfoMap["toStationNo"]

    if (isEmpty(ticketInfoForPassengerMap)) {
        await submitOrderRequest(secretStr, trainDate, trainDate, fromStationName, toStationName)
        ticketInfoForPassengerMap = await getDcTicketInfoForPassenger();
        if (isEmpty(ticketInfoForPassengerMap)) {
            console.log("getDcTicketInfoForPassenger， 查询乘客车票信息失败");
            return;
        }
    }

    let repeatSubmitToken = ticketInfoForPassengerMap["repeatSubmitToken"]
    let passengerStrMap = await getPassengerStr(repeatSubmitToken, passenger, seatType, ticketType);
    let passengerTicketStr = passengerStrMap["passengerTicketStr"];
    let oldPassengerStr = passengerStrMap["oldPassengerStr"];
    console.log(passengerStrMap)
    let isOk = await checkOrderInfo(repeatSubmitToken, passengerTicketStr, oldPassengerStr)
    if (!isOk) return;

    let purposeCodes = ticketInfoForPassengerMap["purposeCodes"];
    let leftTicketStr = ticketInfoForPassengerMap["leftTicketStr"];
    let trainLocation = ticketInfoForPassengerMap["trainLocation"];
    await getQueueCount(repeatSubmitToken, trainDate, trainNo, trainCode, seatType, fromStationNo, toStationNo,
        leftTicketStr, purposeCodes, trainLocation)

    //单程票下单
    let keyCheckIsChange = ticketInfoForPassengerMap["keyCheckIsChange"];
    isOk = await confirmSingleForQueue(repeatSubmitToken, passengerTicketStr, oldPassengerStr, keyCheckIsChange,
        leftTicketStr, trainLocation, purposeCodes);
    if (!isOk) {
        alert("抱歉! 下单失败，请重试");
        return;
    }

    //查询是否购买成功
    let orderId = await queryOrderWaitTime(repeatSubmitToken);
    if (!isEmpty(orderId)) {
        alert("恭喜! 购买成功，请到12306官网支付订单： " + orderId);
    } else {
        alert("购买失败，请重新下单");
    }
}


let keepActive = async () => {
    let ok = await queryMyOrderNotCompleted();
    if (ok) {
        setTimeout(keepActive, 15 * 1000);
    } else {
        console.log("please login in 12306");
        alert("you have logined out from 12306, please relogin!");
    }
}

/**
 * @param passengerName
 * @param repeatSubmitToken
 * @param seatType 座位类型：硬座1,软座2,硬卧3,软卧4
 * @param ticketType 成人票1,儿童票2,学生票3,残军票4
 * @returns {Promise<{}>}
 * {passengerTicketStr: string, oldPassengerStr: string}
 */
async function getPassengerStr(repeatSubmitToken, passengerName, seatType = "3", ticketType = "1") {
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
    //passengerTicketStr: 3,0,1,王建会,1,5129***********921,134****0679,N,ac1b75b8790305815e7205fad734f554643142d77df82bc0478cbf688f9fbe92da55590b265d68237d925ddd55517dba0aad4e1a0cc6310593b84e4bc80f599ad0796f5baba974f5da04069be9bbcc58
    //oldPassengerStr: 王建会,1,5129***********921,1_
    let passengerTicketStr = `${seatType},0,${ticketType},${passengerName},1,${passengerIdNo},${mobileNo},N,${allEncStr}`;
    let oldPassengerStr = `${passengerName},1,${passengerIdNo},1_`;

    return {"passengerTicketStr": passengerTicketStr, "oldPassengerStr": oldPassengerStr}
}

/**
 *
 * @param trainDate
 * @param fromStationName
 * @param toStationName
 * @returns {{}}
 * trainTicketsInfoMap: {"D656":{"secretStr": "xxx", "trainNo": "5e0000D65660"},
 * "G1337":{"secretStr": "xxx", "trainNo": "5l000G133741"}, "fromStationNo": "HGH", "toStationNo": YYY}
 */
let parseAndInitTrainInfo = async (trainDate, fromStationName, toStationName) => {
    let fromStationNo = getStationNo(fromStationName);
    let toStationNo = getStationNo(toStationName);
    let trainTicketsRetMap = await queryLeftTicket(trainDate, fromStationNo, toStationNo);
    console.log(trainTicketsRetMap)
    if (isEmpty(trainTicketsRetMap)) {
        alert("queryLeftTicket 连续多次查询余票失败, 请到官网确认");
        return {};
    }
    let resultArr = trainTicketsRetMap["result"];
    //let stationCodeMap = trainTicketsInfoMap["map"]

    let trainTicketsInfoMap = {}
    trainTicketsInfoMap["fromStationNo"] = fromStationNo;
    trainTicketsInfoMap["toStationNo"] = toStationNo;
    for (let i = 0; i < resultArr.length; i++) {
        //"secretStr-xxkey|预订|5e0000D65660|D656|NGH|CUW|HGH|CUW|08:25|20:32|12:07|Y|zIb8mX2PNvZv65v1crFsdHTJD77ySZn%2FQdOVw%2FW3DSOppnWx|20200929|3|H2|04|23|1|0|||||||无||||14|有|||O0M0W0|OMO|0|0||O055900014M089500021O055903000||||||1|0"
        let oneTrainInfoArr = resultArr[i].split("|");
        let secretStr = oneTrainInfoArr[0]; //每次查询车票，同一班车的这个值都会变化，停运车次该字段为空
        if (isEmpty(secretStr)) {
            console.log("skip %s, empty secretStr", resultArr[i])
        }
        let trainNo = oneTrainInfoArr[2]; // 5e0000D65660
        let trainCode = oneTrainInfoArr[3]; // D656

        trainTicketsInfoMap[trainCode] = {"secretStr": secretStr, "trainNo": trainNo}
    }

    return trainTicketsInfoMap;
}

function isEmpty(obj) {
    return obj === 'undefined' || obj === null || obj === "" || jQuery.isEmptyObject(obj);
}
