const logger = require('@ericw9079/logger');

const DELAY = 5000;

let axios;
const requests = {};

const init = (statusSite) => {
	axios = statusSite;
}

const put = async (uid, newStatus, name, retryCount) => {
	if(!axios){
		logger.error(`Uninitialized updater tried to update ${uid} (${name}) to status ${newStatus}`);
		return;
	}
	if(requests[`id${uid}`]) {
		// Request in progress
		clearTimeout(requests[`id${uid}`]);
	}
	try {
		const res = await axios.put(`/status/${uid}`,{status:newStatus,name});
		delete requests[`id${uid}`]; // Remove the reccord of a request
	}
	catch(e) {
		if(e.response && e.response.status === 500 || e.request) {
			requests[`id${uid}`] = setTimeout(put,DELAY*retryCount,uid,newStatus,name,++retryCount); // Schedule the request for retry
		}
	}
}

const remove = async (uid, retryCount) => {
	if(!axios){
		logger.error(`Uninitialized updater tried to remove ${uid}`);
		return;
	}
	if(requests[`id${uid}`]) {
		// Request in progress
		clearTimeout(requests[`id${uid}`]);
	}
	try {
		const res = await axios.delete(`/status/${uid}`,{});
		delete requests[`id${uid}`]; // Remove the reccord of a request
	}
	catch(e) {
		if(e.response && e.response.status === 500 || e.request) {
			requests[`id${uid}`] = setTimeout(remove,DELAY*retryCount,uid,name,++retryCount); // Schedule the request for retry
		}
	}
}

module.exports = {
	init,
	put: (uid,newStatus,name) => put(uid,newStatus,name,1),
	delete: (uid) => remove(uid,1),
}