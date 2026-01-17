from youtube_comment_downloader import *
import logging
import sys

# Configure logging to stdout
logging.basicConfig(stream=sys.stdout, level=logging.INFO)
logger = logging.getLogger(__name__)

def test():
    video_id = "jNQXAC9IVRw" # Me at the zoo
    url = f"https://www.youtube.com/watch?v={video_id}"
    print(f"Testing URL: {url}")
    
    downloader = YoutubeCommentDownloader()
    
    print("Attempting to get generator...")
    try:
        generator = downloader.get_comments_from_url(url, sort_by=SORT_BY_POPULAR)
        print("Generator created.")
        
        count = 0
        for comment in generator:
            print(f"Got comment: {comment.get('text', '')[:50]}...")
            count += 1
            if count >= 5:
                break
        
        print(f"Total fetched: {count}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test()
