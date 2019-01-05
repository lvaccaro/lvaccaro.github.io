// import javascript opentimestamps in global scope
const OpenTimestamps = window.OpenTimestamps
this.window.Timestamp = OpenTimestamps.Timestamp
this.window.DetachedTimestampFile = OpenTimestamps.DetachedTimestampFile
this.window.Ops = OpenTimestamps.Ops
this.window.Notary = OpenTimestamps.Notary
this.window.Utils = OpenTimestamps.Utils
const bitcore = require('bitcore-lib')

app()
async function app() {
	const link = 'https://lvaccaro.github.io/ots/id.ots'
	$("#link").attr('href',link)
	$("#link").html(link)

	const ots = await get(link)
	try{
		const ctx = new OpenTimestamps.Context.StreamDeserialization(Array.from(ots))
		const detached = OpenTimestamps.DetachedTimestampFile.deserialize(ctx);
		const output = detached.timestamp.strTreeAscii(0 , true)
		const root = "From GPG: " + '<b class="cyan">' + Utils.bytesToHex(detached.timestamp.msg) + '</b>' + '\n'
		$("#text").html(root)
		$("#text").append(output)
	} catch (e) {
		console.log(e)
	}
}

async function get(link) {
	return new Promise((resolve, reject) => {
		var xhr = new XMLHttpRequest();
		xhr.open('GET', link, true);
		xhr.responseType = 'arraybuffer';
		xhr.onload = function (e) {
			resolve(new Uint8Array(this.response));
		};
		xhr.send();
	})
}

function bytesToChars(buffer) {
	let charts = ''
	for (let b = 0; b < buffer.length; b++) {
		charts += String.fromCharCode(buffer[b])[0]
	}
	return charts
}

// extend Timestamp with strTreeAscii() function based on strTree()
OpenTimestamps.Timestamp.prototype.strTreeAscii = function strTree (indent, verbosity) {
	const bcolors = {}
	bcolors.ENDC = '</b>'
	bcolors.BOLD = '<b>'

	function strResult (verb, parameter, result) {
		let rr = ''
		if (verb > 0 && result !== undefined) {
			rr += ' == '
			const resultHex = Utils.bytesToHex(result)
			if (parameter === undefined) {
				rr += resultHex
			} else {
				const parameterHex = Utils.bytesToHex(parameter)
				try {
					const index = resultHex.indexOf(parameterHex)
					const parameterHexHighlight = bcolors.BOLD + parameterHex + bcolors.ENDC
					if (index === 0) {
						rr += parameterHexHighlight + resultHex.substring(index + parameterHex.length, resultHex.length)
					} else {
						rr += resultHex.substring(0, index) + parameterHexHighlight
					}
				} catch (err) {
					rr += resultHex
				}
			}
		}
		return rr
	}

	function strOp(op) {
		var opStr = op._TAG_NAME()
		if (op instanceof Ops.OpAppend || op instanceof Ops.OpPrepend) {
			if (/^[\x20-\x7e]+$/.test(bytesToChars(op.arg))) {
				opStr += '(' + '<b class="cyan">' + bytesToChars(op.arg) + '</b>' + ')'
			} else {
				opStr += '(' + Utils.bytesToHex(op.arg) + ')'
			}
		}
		return opStr
	}

	if (indent === undefined) {
		indent = 0
	}
	if (verbosity === undefined) {
		verbosity = 0
	}
	let r = ''
	if (this.attestations.length > 0) {
		this.attestations.forEach(attestation => {
			const color = (attestation instanceof Notary.BitcoinBlockHeaderAttestation) ? 'green' : 'orange'
			r += '<b class="' + color + '">' + Timestamp.indention(indent) + 'verify ' + attestation.toString() + strResult(verbosity, this.msg) + '</b>' + '\n'

			if (attestation instanceof Notary.BitcoinBlockHeaderAttestation) {
				const tx = Utils.bytesToHex(new Ops.OpReverse().call(this.msg))
				r += '<b class="purple">' + Timestamp.indention(indent) + '# Bitcoin block merkle root ' + tx + '</b>' + '\n'
			}
		})
	}
	if (this.ops.size > 1) {
		this.ops.forEach((timestamp, op) => {
			try {
				bitcore.Transaction(Utils.bytesToHex(this.msg))
				let tx = new Ops.OpReverse().call(new Ops.OpSHA256().call(new Ops.OpSHA256().call(this.msg)))
				tx = Utils.bytesToHex(tx)
				r += '<b class="purple">' + Timestamp.indention(indent) + '# Bitcoin transaction id ' + tx + '</b>' + '\n'
			} catch (err) {
			}
			const curRes = op.call(this.msg)
			const curPar = op.arg
			r += Timestamp.indention(indent) + ' -> ' + op.toString() + strResult(verbosity, curPar, curRes) + '\n'
			r += timestamp.strTree(indent + 1, verbosity)
		})
	} else if (this.ops.size > 0) {
		try {
			bitcore.Transaction(Utils.bytesToHex(this.msg))
			let tx = new Ops.OpReverse().call(new Ops.OpSHA256().call(new Ops.OpSHA256().call(this.msg)))
			tx = Utils.bytesToHex(tx)
			r += '<b class="purple">' + Timestamp.indention(indent) + '# transaction id ' + tx + '</b>' + '\n'
		} catch (err) {
		}
		const op = this.ops.keys().next().value
		const stamp = this.ops.values().next().value
		const curRes = op.call(this.msg)
		const curPar = op.arg
		r += Timestamp.indention(indent) + strOp(op) + strResult(verbosity, curPar, curRes) + '\n'
		r += stamp.strTreeAscii(indent, verbosity)
	}
	return r
}
