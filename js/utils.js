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
            alert("位置类型错误: " + seatType);
            console.log("error seat type: " + seatType);
            return "";
    }
}

const ADULT = 1
const STUDENT = 3
