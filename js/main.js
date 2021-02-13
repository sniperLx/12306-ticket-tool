$(document).ready(() => {
    //长时间保活会被12306强制剔出并禁止登录一段时间
    if ($('#keepalive-task').is(':checked')) {
        //console.log("开始心跳保活");
        //this.keepActive().then(v => console.log("开始心跳保活"));
    }

    $("#submit-task").on('click', () => {
        //姓名/车次/出发日期/起点站/终点站/座位类型/是否成人/开始抢票时间
        let taskInfo = $("#ticket-task-info").val();
        console.log("任务参数： " + taskInfo);
        let paramsArr = taskInfo.split("/");
        if (paramsArr.length !== 8) {
            console.log("任务参数格式不对，请参考例子修正： 张三/K115/2020-09-11/杭州南/重庆北/软卧/Y/11:15");
            alert("输入参数格式不对，请参考例子修正");
            return;
        }

        let seatType = getSeatTypeCode(paramsArr[5]);
        if (isEmpty(seatType)) {
            return;
        }

        let taskParams = {
            "passenger": paramsArr[0], //乘客姓名
            "trainCode": paramsArr[1], //车次
            "trainDate": paramsArr[2], //出发日期,
            "fromStationName": paramsArr[3],  //起点站名
            "toStationName": paramsArr[4],    //终点站名
            "seatType": seatType,  //座位类型
            "ticketType": paramsArr[6] === "Y" ? ADULT : STUDENT, //票类型，成人票或者学生票
            "startOrderTime": paramsArr[7], //开始下单抢票时间
            "fromStationNo": "",
            "toStationNo": "",
            "isOk": false
        };

        let fromStation = getStationNo(taskParams["fromStationName"]);
        let toStation = getStationNo(taskParams["toStationName"])
        if (isEmpty(fromStation) || isEmpty(toStation)) {
            return;
        }

        taskParams["fromStationNo"] =  fromStation;
        taskParams["toStationNo"] = toStation;

        console.log("任务参数： " + JSON.stringify(taskParams));

        let task = new Task(taskParams);
        //异步
        task.submitTask();
    });
})
