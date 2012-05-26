var db = require('mongojs').connect('geochat', ['users']);
var fs = require('fs');
var http = require('http');
var path = require('path');
var io = require('socket.io');
var url = require('url');

// Main app server.
http = http.createServer(function(request, response) {
	var uri = url.parse(request.url).pathname;
	var filename = path.join(process.cwd(), uri);
	path.exists(filename, function(exists) {
		if ( ! exists) {
			response.writeHead(404, { 'Content-Type': 'text/html' });
			fs.readFile(__dirname + '/404.html', function (err, data) {
				if (err) {
					response.write(err + '\n');
					response.end();
				}
				response.end(data);
			});
			return;
		}
		if (fs.statSync(filename).isDirectory()) {
			filename += 'index.html';
		}
		fs.readFile(filename, 'binary', function(err, file) {
			if (err) {
				response.writeHead(500, { 'Content-Type': 'text/plain' });
				response.write(err + '\n');
				response.end();
				return;
			}
			response.writeHead(200);
			response.write(file, 'binary');
			response.end();
			return;
		});
	});
});
http.listen(8000);

// Sockets.
io.listen(http).sockets.on('connection', function (socket) {

	// Login.
	socket.on('login', function (data) {
		db.users.findOne({ username: data.username }, function(err, user) {
			if (err) {
				console.log('Error: cannot login user.', err);
				socket.emit('error', err);
				return;
			}
			if ( ! user) {
				db.users.save({ username: data.username, password: data.password }, function(err, saved) {
					if (err || ! saved) {
						console.log('Error: user not saved.', err);
						socket.emit('error', err);
						return;
					}
					console.log('User created.');
				});
			}
			else if (user.password != data.password) {
				console.log('Login incorrect for user: ' + user.username);
				socket.emit('error', err);
				return;
			}
			socket.set('user', user, function () {
				socket.emit('ready');
			});
			console.log('User ' + data.username + ' logged in.');
		});
	});
	
	// Position.
	socket.on('position', function (position) {
		socket.get('user', function (err, user) {
			console.log('user: ', user);
			if (err || ! user) {
				console.log('Error getting user.');
				return;
			}
			if ( ! position.coords || ! position.coords.latitude || ! position.coords.longitude) {
				console.log('Incorrect position from user: ' + user.username + ' - ', position);
				return;
			}
			console.log('Received position from user: ' + user.username + ' - [' + position.coords.latitude + ',' + position.coords.longitude + ']');
			// Update user position.
			db.users.update({ username: user.username }, {
				$set: {
					pos: {
						lat: position.coords.latitude, 
						lon: position.coords.longitude
					}
				}
			}, function (err, update) {
				if (err || ! update)
					console.log('Error updating position for user: ' + user.nickname);
				
				socket.get('user', function (err, user) {
					user.pos = {
						lat: position.coords.latitude,
						lon: position.coords.longitude
					};
					socket.set('user', user);
				});
			});
		});
	});

	// Message.
	socket.on('msg', function (msg) {
		if (msg === '')
			return;
		
		socket.get('user', function (err, user) {
			if (err || ! user)
				return;

			socket.broadcast.emit('msg', { username: user.username, msg: msg });
		});
	});

	// Handles disconnection.
	socket.on('disconnect', function () {
		clearInterval(updateUsersInt);

		// Clear user position.
		socket.get('user', function (err, user) {
			if (err || ! user) {
				console.log('Error getting user.');
				return;
			}
			db.users.update({ username: user.username }, { $set: { pos: null } }, function (err, update) {
				if (err)
					console.log('Error updating position for user: ' + user.nickname);
			});
		});
	});

	// Update nearby users.
	var updateUsersInt = setInterval(function () {
		socket.get('user', function (err, user) {
			if (err || ! user || ! user.pos)
				return;

			db.users.find({
				pos: { 
					$near: { 
						lat: user.pos.lat, 
						lon: user.pos.lon
					} 
				}
			}, 
			{
				username: 1
			},
			function (err, users) {
				if (err) {
					console.log('Error finding users nearby: [' + position.coords.latitude + ',' + position.coords.longitude + ']', err);
					return;
				}

				socket.emit('users', users);
			}).sort({ username: 1 });
		});
	}, 2000);
});