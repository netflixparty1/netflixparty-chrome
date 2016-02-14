'use strict';

$(function() {
  // get the current tab
  chrome.tabs.query({
      active: true,
      currentWindow: true
    }, function(tabs) {
      // error handling
      var showError = function(err) {
        $('.some-error').removeClass('hidden');
        $('.no-error').addClass('hidden');
        $('#error-msg').html(err);
      };

      $('#close-error').click(function() {
        $('.no-error').removeClass('hidden');
        $('.some-error').addClass('hidden');
        $('#session-id-input').focus();
      });

      // set up the spinner
      var startSpinning = function() {
        $('#session-id-input').prop('disabled', true);
        $('#join-session').prop('disabled', true);
        $('#create-session').prop('disabled', true);
        $('#leave-session').prop('disabled', true);
      };

      var stopSpinning = function() {
        $('#session-id-input').prop('disabled', false);
        $('#join-session').prop('disabled', false);
        $('#create-session').prop('disabled', false);
        $('#leave-session').prop('disabled', false);
      };

      // send a message to the content script
      var sendMessage = function(type, data, callback) {
        startSpinning();
        chrome.tabs.executeScript(tabs[0].id, {
          file: 'content_script.js'
        }, function() {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: type,
            data: data
          }, function(response) {
            stopSpinning();
            if (response.errorMessage) {
              showError(response.errorMessage);
              return;
            }
            if (callback) {
              callback(response);
            }
          });
        });
      };

      // connected/disconnected state
      var showConnected = function(sessionId) {
        $('.disconnected').addClass('hidden');
        $('.connected').removeClass('hidden');
        $('#session-id-info').val(sessionId).focus().select();
        $('#show-chat').prop('checked', true);
        showShareUrl(sessionId);
      };

      var showDisconnected = function() {
        $('.disconnected').removeClass('hidden');
        $('.connected').addClass('hidden');
        $('#control-lock').prop('checked', false);
        $('#session-id-input').val('').focus();
      };

      // get the session if there is one
      sendMessage('getInitData', {
        version: chrome.app.getDetails().version
      }, function(initData) {
        // parse the video ID from the URL
        var videoId = parseInt(tabs[0].url.match(/^.*\/([0-9]+)\??.*/)[1]);

        // if there is a session id in the url, fill the join session input with that value.
        var sessionIdFromUrl = getSessionIdFromUrl(tabs[0].url);
        if (sessionIdFromUrl) {
          $('#session-id-input').val(sessionIdFromUrl).focus().select();
        }

        // initial state
        if (initData.errorMessage) {
          showError(initData.errorMessage);
          return;
        }
        if (initData.sessionId === null) {
          $('#session-id-input').focus();
        } else {
          showConnected(initData.sessionId);
        }
        $('#show-chat').prop('checked', initData.chatVisible);

        // listen for the enter key in the session id field
        $('#session-id-input').keydown(function(e) {
          if (e.which === 13) {
            $('#join-session').click();
          }
        });

        // listen for clicks on the "Join session" button
        $('#join-session').click(function() {
          var sessionId = $('#session-id-input').val();
          sendMessage('joinSession', {
            sessionId: sessionId.replace(/^\s+|\s+$/g, '').toLowerCase(),
            videoId: videoId
          }, function(response) {
            showConnected(sessionId);
          });
        });

        // listen for clicks on the "Create session" button
        $('#create-session').click(function() {
          sendMessage('createSession', {
            controlLock: $('#control-lock').is(':checked'),
            videoId: videoId
          }, function(response) {
            showConnected(response.sessionId);
          });
        });

        // listen for clicks on the "Leave session" button
        $('#leave-session').click(function() {
          sendMessage('leaveSession', {}, function(response) {
            showDisconnected();
          });
        });

        // listen for clicks on the "Show chat" checkbox
        $('#show-chat').change(function() {
          sendMessage('showChat', { visible: $('#show-chat').is(':checked') }, null);
        });
      });
    }
  );
});

function showShareUrl(sessionId) {
  chrome.windows.getCurrent(function(w) {
    chrome.tabs.getSelected(w.id, function (response) {
      var url = response.url.split('?')[0];
      var urlWithId = url + '?npSessionId=' + sessionId;
      $('#share-url').val(urlWithId).focus().select();
      initCopyShareUrl();
    });
  });
}

function getSessionIdFromUrl(url) {
  return getURLParameter(url, 'npSessionId');
}

function getURLParameter(url, key) {
  var searchString = '?' + url.split('?')[1];
  var regex = new RegExp('[?|&]' + key + '=' + '([^&;]+?)(&|#|;|$)');
  return decodeURIComponent((regex.exec(searchString)||[,""])[1].replace(/\+/g, '%20')) || null
}

function initCopyShareUrl() {
  $('#copy-btn').on('click', function(e) {
    e.preventDefault();
    $('#share-url').select();
    document.execCommand('copy');
  });
}
