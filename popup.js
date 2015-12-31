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
        $('#error-msg').text(err);
        $('.alert').fadeIn(function() {
          $(this).delay(4000).fadeOut();
        });
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
          $('#session-id').val(session.id).focus().select();
        }

        // set up the spinner
        var spinnerRefCount = 0;
        var startSpinning = function() {
          if (spinnerRefCount === 0) {
            $('#copySpinner span').removeClass('glyphicon-copy').addClass('glyphicon-refresh glyphicon-spin');
          }
          spinnerRefCount += 1;
        };
        var stopSpinning = function() {
          spinnerRefCount -= 1;
          if (spinnerRefCount === 0) {
            $('#copySpinner span').removeClass('glyphicon-refresh glyphicon-spin').addClass('glyphicon-copy');
          }
        };

        // disabled the "Join session" button when the session ID hasn't changed
        var updateJoinSessionEnabled = function() {
          var sessionId = $('#session-id').val();
          $('#join-session').prop('disabled', ((session && sessionId === session.id) || sessionId.trim() === ''));
          $('#copySpinner').prop('disabled', (sessionId.length <= 0));
        };
        $('#session-id').bind('propertychange change click keyup input paste', updateJoinSessionEnabled);

        // listen for the enter key in the session id field
        $('#session-id').keydown(function(e) {
          if (e.which === 13) {
            $('#join-session').click();
          }
        });

        $('#copySpinner').click(function(e) {
          $('#session-id').focus().select();
          document.execCommand('copy');
          e.preventDefault();
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
            $('#session-id').val(session.id).focus().select();
            updateJoinSessionEnabled();
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
