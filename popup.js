'use strict';

// make sure we are in strict mode
(function() {
  var strictMode = false;
  try {
    NaN = NaN;
  } catch (err) {
    strictMode = true;
  }
  if (!strictMode) {
    throw 'Unable to activate strict mode.';
  }
})();

$(function() {
  // get the current tab
  chrome.tabs.query({
      active: true,
      currentWindow: true
    }, function(tabs) {
      var showError = function(err) {
        $('.some-error').removeClass('hidden');
        $('.no-error').addClass('hidden');
        $('#error-msg').html(err);
      };

      // make sure we got the tab
      if (tabs.length !== 1) {
        return showError('Open a video in Netflix first.');
      }

      // parse the video ID from the URL
      var videoId = null;
      var matches = tabs[0].url.match(/^.*\/([0-9]+)\??.*/);
      if (matches) {
        videoId = parseInt(matches[1]);
      } else {
        return showError('Open a video first.');
      }

      // send a message to the content script
      var sendMessage = function(type, data, callback) {
        chrome.tabs.executeScript(tabs[0].id, {
          file: 'content_script.js'
        }, function() {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: type,
            data: data
          }, callback);
        });
      };

      // get the session if there is one
      sendMessage('getSession', {}, function(session) {
        if (session) {
          $('#session-id').val(session.id);
        }

        // set up the spinner
        var spinnerRefCount = 0;
        var startSpinning = function() {
          if (spinnerRefCount === 0) {
            $('#spinner').removeClass('hidden');
          }
          spinnerRefCount += 1;
        };
        var stopSpinning = function() {
          spinnerRefCount -= 1;
          if (spinnerRefCount === 0) {
            $('#spinner').addClass('hidden');
          }
        };

        // disabled the "Join session" button when the session ID hasn't changed
        var updateJoinSessionEnabled = function() {
          var sessionId = $('#session-id').val();
          if ((session && sessionId === session.id) || sessionId.trim() === '') {
            $('#join-session').prop('disabled', true);
          } else {
            $('#join-session').prop('disabled', false);
          }
        };
        $('#session-id').bind('propertychange change click keyup input paste', updateJoinSessionEnabled);

        // listen for the enter key in the session id field
        $('#session-id').keydown(function(e) {
          if (e.which === 13) {
            $('#join-session').click();
          }
        });

        $('#join-session').click(function() {
          var sessionId = $('#session-id').val();
          startSpinning();
          $.ajax({
            url: 'https://www.netflixparty.com/sessions/' + sessionId,
            method: 'GET'
          }).done(function(data, textStatus, jqXHR) {
            if (data.videoId === videoId) {
              session = data;
              updateJoinSessionEnabled();
              sendMessage('setSession', session, function(response) {
                sendMessage('start', { joiningOther: true }, function(response) {});
              });
              window.close();
            } else {
              return showError('That session is for a different video.');
            }
          }).error(function(jqXHR, textStatus, errorThrown) {
            if (jqXHR.status === 404) {
              return showError('No session with that ID was found.');
            } else {
              return showError('Uh oh! Something went wrong.');
            }
          }).always(function() {
            stopSpinning();
          });
        });

        $('#new-session').click(function() {
          startSpinning();
          $.ajax({
            url: 'https://www.netflixparty.com/sessions/create',
            method: 'POST',
            data: JSON.stringify({
              videoId: videoId
            })
          }).done(function(data, textStatus, jqXHR) {
            session = data;
            $('#session-id').val(session.id);
            updateJoinSessionEnabled();
            $('#session-id').focus();
            $('#session-id').select();
            sendMessage('setSession', session, function(response) {
              sendMessage('start', { joiningOther: false }, function(response) {});
            });
          }).fail(function(jqXHR, textStatus, errorThrown) {
            return showError('Uh oh! Something went wrong.');
          }).always(function() {
            stopSpinning();
          });
        });
      });
    }
  );
});
