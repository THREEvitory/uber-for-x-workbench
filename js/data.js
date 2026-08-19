// 静态演示数据（来自仓库 db/cops.json 与 db/crime-data.json）
const COPS = [
    { userId: "01", displayName: "Officer 001", phone: "01", ratings: "21/25", address: "Kalyan Nagar, Bengaluru", lat: 13.0280047, lng: 77.6399711 },
    { userId: "02", displayName: "Officer 002", phone: "02", ratings: "10/25", address: "Indiranagar, Bengaluru", lat: 12.9718915, lng: 77.6411545 },
    { userId: "03", displayName: "Officer 003", phone: "03", ratings: "15/25", address: "Ulsoor, Bengaluru", lat: 12.9817147, lng: 77.6285585 },
    { userId: "04", displayName: "Officer 004", phone: "04", ratings: "11/25", address: "Shivaji Nagar, Bengaluru", lat: 12.9756140, lng: 77.6054710 },
    { userId: "05", displayName: "Officer 005", phone: "05", ratings: "15/25", address: "Lido Mall, Bengaluru", lat: 12.9728140, lng: 77.6204740 },
    { userId: "06", displayName: "Officer 006", phone: "06", ratings: "21/25", address: "Koramangala, Bengaluru", lat: 12.9279232, lng: 77.6271078 },
    { userId: "07", displayName: "Officer 007", phone: "07", ratings: "18/25", address: "Domlur, Bengaluru", lat: 12.9609857, lng: 77.6387316 }
];

// 历史求助（engaged 的视为已处理，waiting 的作为初始待办）
const INCIDENTS = [
    { id: "h01", time: "2016-10-31T12:12:37Z", lat: 12.934729, lng: 77.612257, address: "The Forum, Bengaluru South", civilianId: "civilian1", status: "engaged", copId: "06" },
    { id: "h02", time: "2016-10-30T11:12:37Z", lat: 12.9609857, lng: 77.6387316, address: "Domlur, Bengaluru", civilianId: "civilian2", status: "engaged", copId: "02" },
    { id: "h03", time: "2016-10-29T10:12:37Z", lat: 12.9792338, lng: 77.6405906, address: "Indiranagar, Bengaluru", civilianId: "civilian3", status: "engaged", copId: "06" },
    { id: "h04", time: "2016-10-28T01:12:37Z", lat: 13.0221617, lng: 77.6357139, address: "Kalyan Nagar, Bengaluru", civilianId: "civilian4", status: "engaged", copId: "01" },
    { id: "h05", time: "2016-10-27T02:12:37Z", lat: 12.9718915, lng: 77.6411545, address: "Indiranagar, Bengaluru", civilianId: "civilian4", status: "waiting", copId: null },
    { id: "h06", time: "2016-10-26T03:12:37Z", lat: 13.0251532, lng: 77.6394072, address: "Kalyan Nagar, Bengaluru", civilianId: "civilian5", status: "waiting", copId: null },
    { id: "h07", time: "2016-10-25T04:12:37Z", lat: 12.9817147, lng: 77.6285585, address: "Murphy Town, Bengaluru", civilianId: "civilian6", status: "engaged", copId: "03" },
    { id: "h08", time: "2016-10-24T05:12:37Z", lat: 12.9748831, lng: 77.6360478, address: "Indiranagar, Bengaluru", civilianId: "civilian7", status: "engaged", copId: "05" },
    { id: "h09", time: "2016-10-23T06:12:37Z", lat: 12.9782859, lng: 77.6387567, address: "Indiranagar, Bengaluru", civilianId: "civilian8", status: "waiting", copId: null },
    { id: "h10", time: "2016-10-22T07:12:37Z", lat: 12.9954659, lng: 77.6234053, address: "Bengaluru", civilianId: "civilian9", status: "engaged", copId: "04" },
    { id: "h11", time: "2016-10-21T07:12:37Z", lat: 12.9713392, lng: 77.5375756, address: "Vijayanagar, Bengaluru", civilianId: "civilian10", status: "waiting", copId: null },
    { id: "h12", time: "2016-10-20T07:12:37Z", lat: 12.9838280, lng: 77.6029210, address: "Shivaji Nagar, Bengaluru", civilianId: "civilian11", status: "engaged", copId: "07" },
    { id: "h13", time: "2016-10-19T07:12:37Z", lat: 12.9510750, lng: 77.5908730, address: "Cubbon Park, Bengaluru", civilianId: "civilian12", status: "waiting", copId: null },
    { id: "h14", time: "2016-10-18T07:12:37Z", lat: 12.8613810, lng: 77.6645430, address: "PESIT South Campus, Bengaluru South", civilianId: "civilian13", status: "engaged", copId: "newCop01" },
    { id: "h15", time: "2016-10-17T07:12:37Z", lat: 13.0425476, lng: 77.5862489, address: "Hebbal, Bengaluru", civilianId: "civilian14", status: "waiting", copId: null },
    { id: "h16", time: "2016-10-16T07:12:37Z", lat: 12.9715670, lng: 77.5941110, address: "ITPL Whitefield, Bengaluru", civilianId: "civilian15", status: "engaged", copId: "newCop02" },
    { id: "h17", time: "2016-10-15T07:12:37Z", lat: 12.9130200, lng: 77.5898400, address: "J.P. Nagar, Bengaluru South", civilianId: "civilian16", status: "waiting", copId: null },
    { id: "h18", time: "2016-10-14T07:12:37Z", lat: 12.9747570, lng: 77.6098350, address: "M G Road, Bengaluru", civilianId: "civilian17", status: "engaged", copId: "newCop03" },
    { id: "h19", time: "2016-10-14T07:12:37Z", lat: 12.9960259, lng: 77.7614444, address: "Whitefield, Bengaluru South", civilianId: "civilian18", status: "waiting", copId: null },
    { id: "h20", time: "2016-10-13T07:12:37Z", lat: 12.9232950, lng: 77.4970230, address: "Bengaluru South", civilianId: "civilian19", status: "engaged", copId: "newCop04" }
];

// 演示模式随机求助的地址池
const DEMO_PLACES = [
    { address: "Indiranagar, Bengaluru", lat: 12.9719, lng: 77.6412 },
    { address: "Koramangala, Bengaluru", lat: 12.9279, lng: 77.6271 },
    { address: "MG Road, Bengaluru", lat: 12.9747, lng: 77.6098 },
    { address: "Cubbon Park, Bengaluru", lat: 12.9511, lng: 77.5909 },
    { address: "Ulsoor, Bengaluru", lat: 12.9817, lng: 77.6286 },
    { address: "Whitefield, Bengaluru", lat: 12.9960, lng: 77.7614 },
    { address: "Hebbal, Bengaluru", lat: 13.0425, lng: 77.5862 },
    { address: "Jayanagar, Bengaluru", lat: 12.9250, lng: 77.5838 },
    { address: "Frazer Town, Bengaluru", lat: 13.0038, lng: 77.6180 },
    { address: "HAL Airport Road, Bengaluru", lat: 12.9507, lng: 77.6682 }
];

const DEFAULT_CENTER = { lat: 12.9719, lng: 77.6412 };
