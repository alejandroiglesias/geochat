'use strict';


// Alert if geolocation is not supported by client.
if ( ! Modernizr.geolocation) {
	throw new Error('Sorry, your device doesn\'t supports geolocation. You can\'t use geolocation chat.');
}


$('#login').show();
$('#chat').hide();

var socket = io.connect('http://garciawebdev.home.kg:8000');


// Ready! Hide login form, send position, enable chat.
socket.on('ready', function () {
	// Hide login, show chat.
	$('#login').hide();
	$('#chat').show();

	// Get current position and send it to server.
	var geoWatchID = navigator.geolocation.watchPosition(function (position) {
		alert(position.coords.latitude +','+position.coords.longitude);
		socket.emit('position', position);
	});

	// Subscribes to nearby users.
	var userList = $('#user-list');
	socket.on('users', function (users) {
		var oldUsers = userList.data('users');
		var newUsers = [];
		userList.find('.user').remove();
		$.each(users, function (key, user) {
			userList.append('<li class="user">' + user.username + '</li>');
			// if ( ! $.inArray(user.username, oldUsers)) {
			// 	$('#messages').append('<p class="notice">' + user.username + ' came nearby</p>');
			// }
			newUsers.push(user.username);
		});
		userList.data('users', newUsers);
	});

	// Subscribes to messages.
	socket.on('msg', function (data) {
		$('#messages').append('<p class="msg"><span class="user">' + data.username + '</span>: ' + data.msg + '</p>');
		window.scrollTo(0, document.body.scrollHeight);
	});

	// Init message form.
	var msgForm = $('#msg');
	var msgInput = msgForm.find('input[name=msg]');
	msgForm.show().on('submit', function (event) {
		event.preventDefault();
		var msg = $.trim(msgInput.val());
		if (msg === '')
			return;

		socket.emit('msg', msg);
		$('#messages').append('<p class="msg"><span class="user me">me</span>: ' + msg + '</p>');
		window.scrollTo(0, document.body.scrollHeight);
		msgInput.val('');
	});
});


// Errors.
socket.on('error', function (err) {
	console.log('error', err);
});


// Login form.
var loginForm = $('#login-form');
loginForm.on('submit', function (event) {
	event.preventDefault();
	var formData = $(this).serializeArray();
	var data = {};
	for (var i in formData) {
		data[formData[i].name] = formData[i].value;
	}
	socket.emit('login', data);
});