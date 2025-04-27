document.addEventListener('DOMContentLoaded', () => {
  // Root container in your HTML page must have id="auction-page"
  const pageContainer = document.getElementById('auction-page');
  if (!pageContainer) {
    console.error('Missing <div id="auction-page"></div> in your HTML.');
    return;
  }

  // Title
  const title = document.createElement('h1');
  title.textContent = 'Live Auction';
  pageContainer.appendChild(title);

  // Container for all auctions
  const listContainer = document.createElement('div');
  listContainer.id = 'auctions-container';
  pageContainer.appendChild(listContainer);

  // Fetch and render auction items
  fetch('/api/auctions')
    .then(res => res.json())
    .then(auctions => {
      if (!Array.isArray(auctions) || auctions.length === 0) {
        listContainer.textContent = 'No auctions available at the moment.';
        return;
      }

      auctions.forEach(auction => {
        const card = document.createElement('div');
        card.className = 'auction-card';
        card.innerHTML = `
          <h2>${auction.title}</h2>
          <p>${auction.description}</p>
          <p>Current Bid: $<span class="current-bid">${auction.currentBid.toFixed(2)}</span></p>
          <form class="bid-form" data-id="${auction.id}">
            <input
              type="number"
              name="bid"
              min="${(auction.currentBid + 1).toFixed(2)}"
              step="0.01"
              placeholder="Your bid"
              required
            />
            <button type="submit">Place Bid</button>
          </form>
          <div class="bid-message" aria-live="polite"></div>
        `;
        listContainer.appendChild(card);

        // Handle bid submission
        const form = card.querySelector('.bid-form');
        form.addEventListener('submit', e => {
          e.preventDefault();
          const bidValue = parseFloat(form.bid.value);
          placeBid(auction.id, bidValue, card);
        });
      });
    })
    .catch(err => {
      console.error('Error fetching auctions:', err);
      listContainer.textContent = 'Failed to load auctions. Please try again later.';
    });

  // Send bid to server and update UI
  function placeBid(auctionId, amount, card) {
    const messageDiv = card.querySelector('.bid-message');
    fetch(`/api/auctions/${auctionId}/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bid: amount })
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          card.querySelector('.current-bid').textContent = amount.toFixed(2);
          messageDiv.textContent = 'Bid placed successfully!';
        } else {
          messageDiv.textContent = result.error || 'Could not place bid.';
        }
      })
      .catch(err => {
        console.error('Error placing bid:', err);
        messageDiv.textContent = 'An error occurred. Please try again.';
      });
  }
});
